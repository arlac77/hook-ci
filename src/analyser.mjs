import { join } from "path";
import globby from "globby";
import { createStep } from "./util.mjs";
import { npmAnalyse } from "./npm.mjs";
import { pkgbuildAnalyse } from "./pkgbuild.mjs";

export const defaultAnalyserConfig = {
  workspace: { dir: "${first(env.STATE_DIRECTORY,'/tmp/hook-ci')}" },
  analyse: {
    skip: ["!test", "!tests"]
  }
};

/**
 * analyse the incoming job and prepare the steps to be executet in the processing queue(s)
 * @param {Object} job
 * @param {Object} config
 * @param {Object} queues
 */
export async function analyseJob(job, config, queues, repositories) {
  const url = job.data.repository.url;

  console.log("start: ", url);

  const branch = await repositories.branch(url);

  console.log("branch: ", branch);

  let wd;

  if (job.data.request && job.data.request.head_commit) {
    const commit = job.data.request.head_commit.id;
    wd = join(config.workspace.dir, commit);
  } else {
    wd = join(config.workspace.dir, String(job.id));
  }

  const steps = [
    createStep({
      name: "git clone",
      executable: "git",
      args: ["clone", "--depth", config.git.clone.depth, url, wd]
    }),
    ...(await npmAnalyse(branch, job, config))
  ];

  await queues.process.add({ wd, ...job.data, steps });
}
