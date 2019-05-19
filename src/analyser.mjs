import { join } from "path";
import globby from "globby";
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
 * @param {Object} job
 * @param {Object} config
 * @param {Object} queues
 * @param {RepositoryProvider} repositories
 */
export async function analyseJob(job, config, queues, repositories) {
  const data = job.data;

  data.repository = data.request.repository;

  const url = data.repository.url;

  const regex = new RegExp(config.analyse.refs.exclude);

  if(data.request.ref.match(regex)) {
    console.log("analyse:", data.event, url, "skipping refs", data.request.ref);
    return undefined;
  }

  const branch_name = data.request.ref.substring("/refs/heads".length);
  data.branch = branch_name;

  console.log("analyse:", data.event, url, branch_name);

  job.progress(5);

  const branch = await repositories.branch(`${url}#${branch_name}`);

  if (branch === undefined) {
    throw new Error(`No such branch: ${url} ${branch_name}`);
  }

  job.progress(10);

  let wd;

  if (data.request && data.request.head_commit) {
    const commit = data.request.head_commit.id;
    if (commit) {
      wd = join(config.workspace.dir, commit);
    }
  }

  if (wd === undefined) {
    wd = join(config.workspace.dir, String(job.id));
  }

  const steps = [
    createStep({
      name: "git clone",
      executable: "git",
      args: [
        "clone",
        "--depth",
        config.git.clone.depth,
        "-b",
        branch_name,
        url,
        wd
      ]
    }),
    ...(await npmAnalyse(branch, job, config, wd))
  ];

  job.progress(90);

  delete data.request;
  const newData = { ...data, steps, wd };

  job.progress(100);

  return newData;
}
