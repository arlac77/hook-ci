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
 * analyse the incoming job and prepare the steps to be executed in the processing queue(s)
 * @param {Job} job
 * @param {Object} bus
 */
export async function analyseJob(job, bus) {
  const config = bus.config;

  const data = job.data;

  const newData = { repository: data.repository };

  const url = data.repository.url || data.repository.clone_url;

  if (url === undefined) {
    console.log("REPOSITORY", data.repository);
    throw new Error("Unknown repository");
  }

  if (data.ref) {
    const regex = new RegExp(config.analyse.refs.exclude);

    if (data.ref.match(regex)) {
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

  const branch = await bus.repositories.branch(`${url}#${newData.branch}`);

  if (branch === undefined) {
    throw new Error(`No such branch: ${url} ${newData.branch}`);
  }

  job.progress(10);

  let wd;

  if (data.head_commit) {
    const commit = data.head_commit.id;
    if (commit) {
      wd = join(bus.config.workspace.dir, commit);
    }
  }

  if (wd === undefined) {
    wd = join(config.workspace.dir, String(job.id));
  }

  //const s1 = await travisAnalyse(branch, job, config, wd);
  const realSteps = [
    ...(await npmAnalyse(branch, job, config, wd)),
    ...(await pkgbuildAnalyse(branch, job, config, wd))
  ];

  if(realSteps.length === 0) {
    throw new Error("Unable to detect any executable steps");
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
    ...realSteps
  ];

  newData.wd = wd;

  job.progress(100);

  return newData;
}
