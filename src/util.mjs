import { join } from "path";
import fs, { createWriteStream } from "fs";
import execa from "execa";

export const utf8Encoding = { encoding: "utf8" };

export function createStep(step) {

  step.execute = async (job, wd) => {
    const cwd = join(wd, step.directory);

    console.log(`${job.id}: ${step.executable} ${stpe.args.join(' ')}`);
    const proc = execa(
      step.executable,
      step.args,
      Object.assign({ cwd }, step.options)
    );
    proc.stdout.pipe(
      createWriteStream(join(wd, `${step.name}.stdout.log`), utf8Encoding)
    );
    proc.stderr.pipe(
      createWriteStream(join(wd, `${step.name}.stderr.log`), utf8Encoding)
    );

    job.progress(step.progress);

    return proc;
  };

  return step;
}


/**
 * strip away currently unused request data
 * @param {Object} request decodec webhook request data
 @ @return {Object} stipped down request data
 */
export function stripUnusedDataFromHookRequest(request)
{
  const repository = request.repository;

  if(repository) {
    delete repository.private;
    delete repository.owner;
    delete repository.fork;
    delete repository.keys_url;
    delete repository.forks_url;
    delete repository.collaborators_url;
    delete repository.teams_url;
    delete repository.hooks_url;
    delete repository.issue_events_url;
    delete repository.events_url;
    delete repository.assignees_url;
    delete repository.branches_url;
    delete repository.tags_url;
    delete repository.blobs_url;
    delete repository.git_tags_url;
    delete repository.git_refs_url;
    delete repository.trees_url;
    delete repository.statuses_url;
    delete repository.languages_url;
    delete repository.stargazers_url;
    delete repository.contributors_url;
    delete repository.subscribers_url;
    delete repository.subscription_url;
    delete repository.commits_url;
    delete repository.git_commits_url;
    delete repository.comments_url;
    delete repository.issue_comment_url;
    delete repository.contents_url;
    delete repository.compare_url;
    delete repository.merges_url;
    delete repository.archive_url;
    delete repository.downloads_url;
    delete repository.issues_url;
    delete repository.pulls_url;
    delete repository.milestones_url;
    delete repository.notifications_url;
    delete repository.labels_url;
    delete repository.releases_url;
    delete repository.deployments_url;
    delete repository.git_url;
    delete repository.svn_url;
    delete repository.clone_url;
    delete repository.ssh_url;
    delete repository.stargazers_count;
    delete repository.forks_count;
    delete repository.mirror_url;
    delete repository.archived;
    delete repository.disabled;
    delete repository.open_issues_count;
    delete repository.forks;
    delete repository.open_issues;
    delete repository.watchers;
    delete repository.default_branch;
    delete repository.stargazers;
    delete repository.license;
    delete repository.has_issues;
    delete repository.has_projects;
    delete repository.has_downloads;
    delete repository.has_wiki;
    delete repository.has_pages;
    delete repository.html_url;
    delete repository.homepage;
  }

  const sender = request.sender;
  if(sender) {
    delete sender.avatar_url;
    delete sender.gravatar_id;
    delete sender.url;
    delete sender.html_url;
    delete sender.followers_url;
    delete sender.following_url;
    delete sender.gists_url;
    delete sender.starred_url;
    delete sender.subscriptions_url;
    delete sender.organizations_url;
    delete sender.repos_url;
    delete sender.events_url;
    delete sender.received_events_url;
  }

  return request;
}
