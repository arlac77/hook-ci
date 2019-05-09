import globby from "globby";


import { npmAnalyse } from "./npm.mjs";
import { pkgbuildAnalyse } from "./pkgbuild.mjs";


export const defaultAnalyserConfig = {
  analyse: {
    skip: ["!test", "!tests"]
  }
}

/**
 * analyse the incoming job and prepare the steps to be executet in the processing queue(s)
 * @param {Object} config
 */
export async function analyseJob(job,config, queues) {

}
