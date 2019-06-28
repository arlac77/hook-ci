
export const utf8Encoding = { encoding: "utf8" };

export function createStep(step) {
  return { name: "unnamed", args: [], options: {}, ...step };
}

/**
 * extract ci notification from line
 * @param {string} line
 * @return {string} notification body or undefined 
 */
function extractCINotification(line) {
  const m = line.match(/^#<CI>\s*(.*)/);
  if (m) {
    return m[1];
  }
  return undefined;
}

/**
 * add log entries to a job
 * @param {ReadableStream} stream
 * @param {Job} job
 * @param {Function} notificationHandler
 */
export async function streamIntoJob(stream, job, notificationHandler) {
  let remainder = "";

  for await (const chunk of stream) {
    const lines = chunk.toString("utf8").split(/\r?\n/);
    if (lines.length === 1) {
      remainder += lines[0];
    } else {
      lines[0] = remainder + lines[0];
      remainder = lines.pop();

      for (const line of lines) {

        const ci = extractCINotification(line);
        if (ci === undefined) {
          job.log(line);
        }
        else {
          notificationHandler(ci);
        }
      }
    }
  }

  if (remainder.length > 0) {
    const ci = extractCINotification(remainder);
    if (ci === undefined) {
      job.log(remainder);
    }
    else {
      notificationHandler(ci);
    }
  }
}

/**
 * strip away currently unused request data
 * @param {Object} request decodec webhook request data
 @ @return {Object} stipped down request data
 */
export function stripUnusedDataFromHookRequest(request) {
  const repository = request.repository;

  if (repository) {
    [
      "private",
      "owner",
      "fork",
      "keys_url",
      "forks_url",
      "collaborators_url",
      "teams_url",
      "hooks_url",
      "issue_events_url",
      "events_url",
      "assignees_url",
      "branches_url",
      "tags_url",
      "blobs_url",
      "git_tags_url",
      "git_refs_url",
      "trees_url",
      "statuses_url",
      "languages_url",
      "stargazers_url",
      "contributors_url",
      "subscribers_url",
      "subscription_url",
      "commits_url",
      "git_commits_url",
      "comments_url",
      "issue_comment_url",
      "contents_url",
      "compare_url",
      "merges_url",
      "archive_url",
      "downloads_url",
      "issues_url",
      "pulls_url",
      "milestones_url",
      "notifications_url",
      "labels_url",
      "releases_url",
      "deployments_url",
      "git_url",
      "svn_url",
      "ssh_url",
      "stargazers_count",
      "forks_count",
      "mirror_url",
      "archived",
      "disabled",
      "open_issues_count",
      "forks",
      "open_issues",
      "watchers",
      "default_branch",
      "stargazers",
      "license",
      "has_issues",
      "has_projects",
      "has_downloads",
      "has_wiki",
      "has_pages",
      "html_url",
      "homepage"
    ].forEach(key => delete repository[key]);
  }

  const sender = request.sender;
  if (sender) {
    [
      "avatar_url",
      "gravatar_id",
      "url",
      "html_url",
      "followers_url",
      "following_url",
      "gists_url",
      "starred_url",
      "subscriptions_url",
      "organizations_url",
      "repos_url",
      "events_url",
      "received_events_url"
    ].forEach(key => delete sender[key]);
  }

  return request;
}
