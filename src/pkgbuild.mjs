import { join, dirname } from "path";
import { createStep } from "./util.mjs";

export async function pkgbuildAnalyse(branch, job, config, wd) {
  const steps = [];
  const requirements = [];

  for await (const entry of branch.entries([
    "**/PKGBUILD",
    ...config.analyse.entries.exclude
  ])) {
    steps.push(
      createStep({
        name: "build",
        executable: "makepkg",
        args: [],
        options: { cwd: join(wd, dirname(pkg)) }
      })
    );
  }
  return steps;
}
