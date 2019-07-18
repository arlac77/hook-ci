import test from "ava";
import got from "got";
import { GithubProvider } from "github-repository-provider";
import signer from "x-hub-signature/src/signer";
import { initializeServer } from "../src/server.mjs";
import { LocalNode } from "../src/nodes.mjs";

const hook = "webhook";
const secret = "aSecret";
const sd = { notify: () => {}, listeners: () => [] };

let _port = 3149;

function nextPort() {
  return _port++;
}

const queues = {
  incoming: {
    async getJobLogs(job, from = 0, to = 10) {
      const lines = [];

      while (from < to) {
        lines.push(`line ${from}`);
        from++;
      }

      return { lines };
    },
    async add(data) {
      return { id: 77, queue: { name: "incoming", data } };
    },
    async getJobs() {
      return [
        {
          id: "job1",
          data: {
            event: "push",
            repository: { full_name: "repo1" },
            ref: "refs/heads/template-sync-1"
          }
        },
        {
          id: "job2",
          data: {
            event: "push",
            repository: { full_name: "repo2" },
            ref: "refs/heads/template-sync-2"
          }
        }
      ];
    },
    getActiveCount() {
      return 0;
    },
    getWaitingCount() {
      return 0;
    },
    getPausedCount() {
      return 0;
    },
    getCompletedCount() {
      return 0;
    },
    getFailedCount() {
      return 0;
    },
    getDelayedCount() {
      return 0;
    }
  }
};

test("incoming jobs", async t => {
  const port = nextPort();
  const bus = {
    config: {
      version: 99,
      http: {
        port
      }
    },
    sd,
    queues
  };

  await initializeServer(bus);

  const response = await got.get(
    `http://localhost:${port}/queue/incoming/jobs`
  );

  t.is(response.statusCode, 200);

  const json = JSON.parse(response.body);
  t.true(json.length >= 1);
  t.is(json[0].id, "job1");
  t.is(json[1].repository.full_name, "repo2");

  bus.server.close();
});

test("request repositories", async t => {
  const port = nextPort();
  const bus = {
    config: {
      version: 99,
      http: {
        port
      }
    },
    sd,
    queues,
    repositories: new GithubProvider(
      GithubProvider.optionsFromEnvironment(process.env)
    )
  };

  await initializeServer(bus);

  const response = await got.get(
    `http://localhost:${port}/repositories?pattern=arlac77/sync-test*`
  );

  t.is(response.statusCode, 200);

  const json = JSON.parse(response.body);
  t.true(json.length >= 1);
  t.is(json[0].name, "sync-test-repository");

  bus.server.close();
});

test("request queues", async t => {
  const port = nextPort();
  const bus = {
    config: {
      version: 99,
      http: {
        port
      }
    },
    sd,
    queues
  };

  await initializeServer(bus);

  const response = await got.get(`http://localhost:${port}/queues`);

  t.is(response.statusCode, 200);

  const json = JSON.parse(response.body);
  t.true(json.length >= 1);
  t.is(json[0].name, "incoming");

  bus.server.close();
});

test("incoming queue", async t => {
  const port = nextPort();
  const bus = {
    config: {
      version: 99,
      http: {
        port
      }
    },
    sd,
    queues
  };

  await initializeServer(bus);

  const response = await got.get(`http://localhost:${port}/queue/incoming`);

  t.is(response.statusCode, 200);

  const json = JSON.parse(response.body);
  t.is(json.name, "incoming");

  bus.server.close();
});

test("incoming job logs", async t => {
  const port = nextPort();
  const bus = {
    config: {
      version: 99,
      http: {
        port
      }
    },
    sd,
    queues
  };

  await initializeServer(bus);

  const response = await got.get(
    `http://localhost:${port}/queue/incoming/job/1/log?start=1&end=3`
  );

  t.is(response.statusCode, 200);

  const json = JSON.parse(response.body);
  t.deepEqual(json, { lines: ["line 1", "line 2"] });

  bus.server.close();
});

test("pause/resume/empty queues", async t => {
  const port = nextPort();
  let paused, resumed, empty;

  queues.incoming.pause = async () => {
    paused = true;
  };

  queues.incoming.resume = async () => {
    resumed = true;
  };

  queues.incoming.empty = async () => {
    empty = true;
  };

  const bus = {
    config: {
      version: 99,
      http: {
        port
      }
    },
    sd,
    queues
  };

  await initializeServer(bus);

  let response = await got.post(
    `http://localhost:${port}/queue/incoming/pause`
  );
  t.is(response.statusCode, 200);
  t.true(paused);

  response = await got.post(`http://localhost:${port}/queue/incoming/resume`);
  t.is(response.statusCode, 200);
  t.true(resumed);

  response = await got.post(`http://localhost:${port}/queue/incoming/empty`);
  t.is(response.statusCode, 200);
  t.true(empty);

  bus.server.close();
});

test("get nodes state", async t => {
  const port = nextPort();
  const config = {
    version: 99,
    http: {
      port
    }
  };

  const bus = {
    config,
    sd,
    queues,
    nodes: [new LocalNode("local", { config })]
  };

  await initializeServer(bus);

  const response = await got.get(`http://localhost:${port}/nodes/state`);

  t.is(response.statusCode, 200);

  const json = JSON.parse(response.body);
  t.is(json.length, 1);
  t.is(json[0].version, 99);
  t.true(json[0].versions.node.length > 2);
  t.true(json[0].uptime > 0.001);

  //console.log(json[0].capabilities);
  bus.server.close();
});

test("github push", async t => {
  const port = nextPort();
  const bus = {
    config: {
      version: 99,
      http: {
        port,
        hooks: {
          github: {
            path: hook,
            secret,
            queue: "incoming"
          }
        }
      }
    },
    sd,
    queues: {
      incoming: {
        add(job) {
          payload = job;
          return { id: 77, queue: { name: "incoming" } };
        }
      }
    }
  };

  await initializeServer(bus);

  let payload;

  const sign = signer({ algorithm: "sha1", secret });
  const signature = sign(new Buffer(pushBody));

  const response = await got.post(`http://localhost:${port}/${hook}`, {
    headers: {
      "X-Hub-Signature": signature,
      "content-type": "application/json",
      "X-GitHub-Delivery": "7453c7ec-5fa2-11e9-9af1-60fccbf37b5b",
      "X-GitHub-Event": "push"
    },
    body: pushBody
  });

  //console.log(payload);

  //console.log(response.body);

  t.is(response.statusCode, 200);
  t.is(payload.event, "push");
  t.is(payload.repository.full_name, "arlac77/npm-template-sync-github-hook");
  t.is(payload.ref, "refs/heads/template-sync-1");

  bus.server.close();
});

const pushBody = JSON.stringify({
  ref: "refs/heads/template-sync-1",
  before: "0e19c5c2e158421ee2b2dfe0a70c29604b9d0cea",
  after: "0000000000000000000000000000000000000000",
  created: false,
  deleted: true,
  forced: false,
  base_ref: null,
  compare:
    "https://github.com/arlac77/npm-template-sync-github-hook/compare/0e19c5c2e158...000000000000",
  commits: [],
  head_commit: null,
  repository: {
    id: 113093573,
    node_id: "MDEwOlJlcG9zaXRvcnkxMTMwOTM1NzM=",
    name: "npm-template-sync-github-hook",
    full_name: "arlac77/npm-template-sync-github-hook",
    private: false,
    owner: {
      name: "arlac77",
      email: "Markus.Felten@gmx.de",
      login: "arlac77",
      id: 158862,
      node_id: "MDQ6VXNlcjE1ODg2Mg==",
      avatar_url: "https://avatars1.githubusercontent.com/u/158862?v=4",
      gravatar_id: "",
      url: "https://api.github.com/users/arlac77",
      html_url: "https://github.com/arlac77",
      followers_url: "https://api.github.com/users/arlac77/followers",
      following_url:
        "https://api.github.com/users/arlac77/following{/other_user}",
      gists_url: "https://api.github.com/users/arlac77/gists{/gist_id}",
      starred_url:
        "https://api.github.com/users/arlac77/starred{/owner}{/repo}",
      subscriptions_url: "https://api.github.com/users/arlac77/subscriptions",
      organizations_url: "https://api.github.com/users/arlac77/orgs",
      repos_url: "https://api.github.com/users/arlac77/repos",
      events_url: "https://api.github.com/users/arlac77/events{/privacy}",
      received_events_url:
        "https://api.github.com/users/arlac77/received_events",
      type: "User",
      site_admin: false
    },
    html_url: "https://github.com/arlac77/npm-template-sync-github-hook",
    description: "github hook for npm-template-sync",
    fork: false,
    url: "https://github.com/arlac77/npm-template-sync-github-hook",
    forks_url:
      "https://api.github.com/repos/arlac77/npm-template-sync-github-hook/forks",
    keys_url:
      "https://api.github.com/repos/arlac77/npm-template-sync-github-hook/keys{/key_id}",
    collaborators_url:
      "https://api.github.com/repos/arlac77/npm-template-sync-github-hook/collaborators{/collaborator}",
    teams_url:
      "https://api.github.com/repos/arlac77/npm-template-sync-github-hook/teams",
    hooks_url:
      "https://api.github.com/repos/arlac77/npm-template-sync-github-hook/hooks",
    issue_events_url:
      "https://api.github.com/repos/arlac77/npm-template-sync-github-hook/issues/events{/number}",
    events_url:
      "https://api.github.com/repos/arlac77/npm-template-sync-github-hook/events",
    assignees_url:
      "https://api.github.com/repos/arlac77/npm-template-sync-github-hook/assignees{/user}",
    branches_url:
      "https://api.github.com/repos/arlac77/npm-template-sync-github-hook/branches{/branch}",
    tags_url:
      "https://api.github.com/repos/arlac77/npm-template-sync-github-hook/tags",
    blobs_url:
      "https://api.github.com/repos/arlac77/npm-template-sync-github-hook/git/blobs{/sha}",
    git_tags_url:
      "https://api.github.com/repos/arlac77/npm-template-sync-github-hook/git/tags{/sha}",
    git_refs_url:
      "https://api.github.com/repos/arlac77/npm-template-sync-github-hook/git/refs{/sha}",
    trees_url:
      "https://api.github.com/repos/arlac77/npm-template-sync-github-hook/git/trees{/sha}",
    statuses_url:
      "https://api.github.com/repos/arlac77/npm-template-sync-github-hook/statuses/{sha}",
    languages_url:
      "https://api.github.com/repos/arlac77/npm-template-sync-github-hook/languages",
    stargazers_url:
      "https://api.github.com/repos/arlac77/npm-template-sync-github-hook/stargazers",
    contributors_url:
      "https://api.github.com/repos/arlac77/npm-template-sync-github-hook/contributors",
    subscribers_url:
      "https://api.github.com/repos/arlac77/npm-template-sync-github-hook/subscribers",
    subscription_url:
      "https://api.github.com/repos/arlac77/npm-template-sync-github-hook/subscription",
    commits_url:
      "https://api.github.com/repos/arlac77/npm-template-sync-github-hook/commits{/sha}",
    git_commits_url:
      "https://api.github.com/repos/arlac77/npm-template-sync-github-hook/git/commits{/sha}",
    comments_url:
      "https://api.github.com/repos/arlac77/npm-template-sync-github-hook/comments{/number}",
    issue_comment_url:
      "https://api.github.com/repos/arlac77/npm-template-sync-github-hook/issues/comments{/number}",
    contents_url:
      "https://api.github.com/repos/arlac77/npm-template-sync-github-hook/contents/{+path}",
    compare_url:
      "https://api.github.com/repos/arlac77/npm-template-sync-github-hook/compare/{base}...{head}",
    merges_url:
      "https://api.github.com/repos/arlac77/npm-template-sync-github-hook/merges",
    archive_url:
      "https://api.github.com/repos/arlac77/npm-template-sync-github-hook/{archive_format}{/ref}",
    downloads_url:
      "https://api.github.com/repos/arlac77/npm-template-sync-github-hook/downloads",
    issues_url:
      "https://api.github.com/repos/arlac77/npm-template-sync-github-hook/issues{/number}",
    pulls_url:
      "https://api.github.com/repos/arlac77/npm-template-sync-github-hook/pulls{/number}",
    milestones_url:
      "https://api.github.com/repos/arlac77/npm-template-sync-github-hook/milestones{/number}",
    notifications_url:
      "https://api.github.com/repos/arlac77/npm-template-sync-github-hook/notifications{?since,all,participating}",
    labels_url:
      "https://api.github.com/repos/arlac77/npm-template-sync-github-hook/labels{/name}",
    releases_url:
      "https://api.github.com/repos/arlac77/npm-template-sync-github-hook/releases{/id}",
    deployments_url:
      "https://api.github.com/repos/arlac77/npm-template-sync-github-hook/deployments",
    created_at: 1512420666,
    updated_at: "2019-04-15T17:18:14Z",
    pushed_at: 1555348695,
    git_url: "git://github.com/arlac77/npm-template-sync-github-hook.git",
    ssh_url: "git@github.com:arlac77/npm-template-sync-github-hook.git",
    clone_url: "https://github.com/arlac77/npm-template-sync-github-hook.git",
    svn_url: "https://github.com/arlac77/npm-template-sync-github-hook",
    homepage: "",
    size: 368,
    stargazers_count: 0,
    watchers_count: 0,
    language: "JavaScript",
    has_issues: true,
    has_projects: true,
    has_downloads: true,
    has_wiki: true,
    has_pages: false,
    forks_count: 0,
    mirror_url: null,
    archived: false,
    disabled: false,
    open_issues_count: 0,
    license: {
      key: "bsd-2-clause",
      name: 'BSD 2-Clause "Simplified" License',
      spdx_id: "BSD-2-Clause",
      url: "https://api.github.com/licenses/bsd-2-clause",
      node_id: "MDc6TGljZW5zZTQ="
    },
    forks: 0,
    open_issues: 0,
    watchers: 0,
    default_branch: "master",
    stargazers: 0,
    master_branch: "master"
  },
  pusher: {
    name: "arlac77",
    email: "Markus.Felten@gmx.de"
  },
  sender: {
    login: "arlac77",
    id: 158862,
    node_id: "MDQ6VXNlcjE1ODg2Mg==",
    avatar_url: "https://avatars1.githubusercontent.com/u/158862?v=4",
    gravatar_id: "",
    url: "https://api.github.com/users/arlac77",
    html_url: "https://github.com/arlac77",
    followers_url: "https://api.github.com/users/arlac77/followers",
    following_url:
      "https://api.github.com/users/arlac77/following{/other_user}",
    gists_url: "https://api.github.com/users/arlac77/gists{/gist_id}",
    starred_url: "https://api.github.com/users/arlac77/starred{/owner}{/repo}",
    subscriptions_url: "https://api.github.com/users/arlac77/subscriptions",
    organizations_url: "https://api.github.com/users/arlac77/orgs",
    repos_url: "https://api.github.com/users/arlac77/repos",
    events_url: "https://api.github.com/users/arlac77/events{/privacy}",
    received_events_url: "https://api.github.com/users/arlac77/received_events",
    type: "User",
    site_admin: false
  }
});
