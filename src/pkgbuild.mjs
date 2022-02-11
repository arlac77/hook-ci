import { join, dirname } from "path";
import { createStep } from "./util.mjs";

export async function pkgbuildAnalyse(branch, job, config, wd) {
  const steps = [];

  for await (const entry of branch.entries([
    "**/PKGBUILD",
    ...config.analyse.entries.exclude
  ])) {
    const requirements = [{
      executable: "makepkg"
    }];

    const content = await entry.string;

    let m = content.match(/arch=\(([^\)]+)\)/);

    if(m) {
      let arch = m[1];
      m = arch.match(/^'(.+)'$/);
      if(m) {
        arch = m[1];
        requirements.push({ architecture: arch });
      }
    }

    steps.push(
      createStep({
        name: "build",
        executable: "makepkg",
        args: [],
        options: { cwd: join(wd, dirname(entry.name)) },
        requirements
      })
    );
  }
  return steps;
}
