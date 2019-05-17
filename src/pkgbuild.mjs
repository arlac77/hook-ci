import { join, dirname } from "path";
import globby from "globby";
import { utf8Encoding, createStep } from "./util.mjs";

export async function pkgbuildAnalyse(config,wd) {
  const steps = [];

  for (const pkg of await globby(["**/PKGBUILD", ...config.analyse.skip], { cwd: wd })) {
    steps.push(
      createStep({
        name: "build",
        executable: "makepkg",
        args: [],
        progress: 100,
        options: { cwd: join(wd,dirname(pkg)) }
      })
    );
  }

  return steps;
}
