import { join, dirname } from "path";
import globby from "globby";
import { utf8Encoding, createStep } from "./util.mjs";


export async function pkgbuildAnalyse(wd) {
  const steps = [];

  for (const pkg of await globby(["**/PKGBUILD"], { cwd: wd })) {
    const directory = dirname(pkg);

    steps.push(
      createStep({
        name: "build",
        directory,
        executable: "makepkg",
        args: [],
        progress: 100
      })
    );
  }

  return steps;
}
