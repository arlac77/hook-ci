import globby from "globby";

import { npmAnalyse } from "./npm.mjs";
import { pkgbuildAnalyse } from "./pkgbuild.mjs";

export const defaultAnalyserConfig = {
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

  await queues.process.add({ steps: [{ type: "exec" }] });
}

export class Analyser {}
