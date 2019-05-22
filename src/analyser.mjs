import { join } from "path";
import { createStep } from "./util.mjs";
import { npmAnalyse } from "./npm.mjs";
import { pkgbuildAnalyse } from "./pkgbuild.mjs";

export const defaultAnalyserConfig = {
  workspace: { dir: "${first(env.STATE_DIRECTORY,'/tmp/hook-ci')}" },
  analyse: {
    entries: {
      exclude: ["!test/**/*", "!tests/**/*"]
    },
    refs: {
      exclude: "/refs/tags/"
    },
    analyser: [
      {
        type: "npm",
        logLevel: "debug"
      },
      {
        type: "pkgbuild"
      }
    ]
  }
};

/**
 * analyse the incoming job and prepare the steps to be executet in the processing queue(s)
 * @param {Job} job
 * @param {Object} config
 * @param {Object} queues
 * @param {RepositoryProvider} repositories
 */
export async function analyseJob(job, config, queues, repositories) {
  const data = job.data;

  const newData = { repository : data.repository };

  const url = data.repository.url || data.repository.clone_url;

  if(data.ref) {
    const regex = new RegExp(config.analyse.refs.exclude);

    if(data.ref.match(regex)) {
      console.log("analyse:", data.event, url, "skipping refs", data.ref);
      return undefined;
    }

    newData.branch = data.ref.substring("/refs/heads".length);
  }
  else {
    newData.branch = 'master';
  }

  console.log("analyse:", data.event, url, newData.branch);

  job.progress(5);

  const branch = await repositories.branch(`${url}#${newData.branch}`);

  if (branch === undefined) {
    throw new Error(`No such branch: ${url} ${newData.branch}`);
  }

  job.progress(10);

  let wd;

  if (data.head_commit) {
    const commit = data.head_commit.id;
    if (commit) {
      wd = join(config.workspace.dir, commit);
    }
  }

  if (wd === undefined) {
    wd = join(config.workspace.dir, String(job.id));
  }

  newData.steps = [
    createStep({
      name: "git clone",
      executable: "git",
      args: [
        "clone",
        "--depth",
        config.git.clone.depth,
        "-b",
        newData.branch,
        url,
        wd
      ]
    }),
    ...(await npmAnalyse(branch, job, config, wd))
  ];

  newData.wd = wd;

  job.progress(100);

  return newData;
}
