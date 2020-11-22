import { join, dirname } from "path";
import { createStep } from "./util.mjs";

/**
 * Search for Cargo.toml
 */
export async function cargoAnalyse(branch, job, config, wd) {
  const steps = [];

  for await (const entry of branch.entries([
    "**/Cargo.toml",
    ...config.analyse.entries.exclude
  ])) {
    steps.push(
      createStep({
        name: "build",
        executable: "cargo",
        args: ["test"],
        options: { cwd: join(wd, dirname(entry.name)) },
        requirements: [{
          executable: "cargo"
        }]
      })
    );
  }
  return steps;
}
