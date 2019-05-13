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
  const data = job.data;

  data.repository = data.request.repository;

  const url = data.repository.url;

  console.log("start: ", url);

  job.progress(5);

  const branch = await repositories.branch(url);

  job.progress(10);

  console.log("branch: ", branch.fullName);

  let wd;

  if (data.request && data.request.head_commit) {
    const commit = data.request.head_commit.id;
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

  job.progress(90);

  const newData = { ...data, steps, wd };
  console.log(newData);
  await queues.process.add(newData);

  job.progress(100);
}
