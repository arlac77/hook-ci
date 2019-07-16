import { join, dirname } from "path";
import { createStep } from "./util.mjs";

/**
 * 
 * search for build.sh
 */
export async function buildAnalyse(branch, job, config, wd) {
  const steps = [];

  for await (const entry of branch.entries([
    "**/build.sh",
    ...config.analyse.entries.exclude
  ])) {
    steps.push(
      createStep({
        name: "build",
        executable: "./build.sh",
        args: [],
        options: { cwd: join(wd, dirname(entry.name)) },
        requirements: [{
          executable: "sh"
        }]
      })
    );
  }
  return steps;
}
