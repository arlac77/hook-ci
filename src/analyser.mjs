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
 * @param {RepositoryProvider} repositories
 */
export async function analyseJob(job, config, queues, repositories) {
  const data = job.data;

  data.repository = data.request.repository;

  const url = data.repository.url;

  console.log("start: ", url);

  job.progress(5);

  const branch = await repositories.branch(url);

  job.progress(10);

  let wd;

  if(data.request) {
    const commit = data.request.head_commit.id;
    if(commit) {
      wd = join(config.workspace.dir, commit);
    }
  }

  if(wd === undefined) {
    wd = join(config.workspace.dir, String(job.id));
  }

  const steps = [
    createStep({
      name: "git clone",
      executable: "/usr/bin/git",
      args: ["clone", "--depth", config.git.clone.depth, url, wd]
    }),
    ...(await npmAnalyse(branch, job, config, wd))
  ];

  job.progress(90);

  const newData = { ...data, steps, wd };
  console.log(newData);
  await queues.process.add(newData);

  job.progress(100);
}
