import { createStep } from "./util.mjs";
import { npmAnalyse } from "./npm.mjs";
import { pkgbuildAnalyse } from "./pkgbuild.mjs";
import { buildAnalyse } from "./buildAnalyse.mjs";

export const defaultAnalyserConfig = {
  workspace: { dir: "${first(env.STATE_DIRECTORY,'/tmp/hook-ci')}" },
  analyse: {
    entries: {
      exclude: ["!test/**/*", "!tests/**/*"]
    },
    refs: {
      exclude: "^refs\\/tags"
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
 * Analyse the incoming job and prepare the steps to be executed in the processing queue(s)
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
      return undefined; // skip job
    }

    newData.branch = data.ref.slice("refs/heads/".length);
  } else {
    newData.branch = "master";
  }

  console.log("analyse:", data.event, url, newData.branch);

  job.progress(5);

  const branch = await bus.sp.repositories.provider.branch(`${url}#${newData.branch}`);

  if (branch === undefined) {
    throw new Error(`No such branch: ${url} ${newData.branch}`);
  }

  job.progress(10);

  let wd = String(job.id);

  if (data.head_commit) {
    const commit = data.head_commit.id;
    if (commit) {
      wd = commit;
    }
  }

  //const s1 = await travisAnalyse(branch, job, config, wd);

  const wde = '{{workspaceDirectory}}';

  const realSteps = (await Promise.all(
    [npmAnalyse, pkgbuildAnalyse, buildAnalyse].map(a => a(branch, job, config, wde))
  )).reduce((a, c) => {
    a.push(...c);
    return a;
  }, []);


  if (realSteps.length === 0) {
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
        wde
      ]
    }),
    ...realSteps
  ];

  newData.wd = wd;
  newData.node = bus.config.nodename;

  job.progress(100);

  return newData;
}
