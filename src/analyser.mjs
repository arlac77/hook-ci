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
      exclude: "/refs/tags/.*"
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

  if (data.request.ref.startsWith("/refs/tags")) {
    console.log("analyse:", data.event, url, "skipping tags", data.request.ref);
    return {};
  }

  const branch_name = data.request.ref.substring("/refs/heads".length);
  data.branch = branch_name;

  console.log("analyse:", data.event, url, branch_name);

  job.progress(5);

  const branch = await repositories.branch(`${url}#${branch_name}`);

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

  const newData = { ...data, steps, wd };

  await queues.process.add(newData);

  job.progress(100);
}
