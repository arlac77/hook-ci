import { join, dirname } from "path";
import fs from "fs";
import globby from "globby";

import { utf8Encoding, createStep } from "./util.mjs";

const wellKnownScripts = new Set(["install", "test", "publish"]);

export async function npmAnalyse(config,wd) {
  const steps = [];

  for (const pkg of await globby(["**/package.json", ...config.analyse.skip], { cwd: wd })) {
    const file = join(wd, pkg);
    const json = JSON.parse(await fs.promises.readFile(file, utf8Encoding));

    const directory = dirname(pkg);

    if(json.engines) {
      if(json.engines.node) {
          // select node
      }
    }

    steps.push(
      createStep({
        name: "prepare",
        directory,
        executable: "npm",
        args: ["install"],
        progress: 10
      })
    );

    if (json.scripts) {
      if (json.scripts.cover) {
        steps.push(
          createStep({
            name: "test",
            directory,
            executable: "npm",
            args: ["run", "cover"],
            progress: 30
          })
        );
      }
      else if (json.scripts.test) {
        steps.push(
          createStep({
            name: "test",
            directory,
            executable: "npm",
            args: ["test"],
            progress: 30
          })
        );
      }
      if (json.scripts.docs) {
        steps.push(
          createStep({
            name: "test",
            directory,
            executable: "npm",
            args: ["run", "docs"],
            progress: 40
          })
        );
      }
    }

    if (json.devDependencies && json.devDependencies["semantic-release"]) {
      steps.push(
        createStep({
          name: "deploy",
          directory,
          executable: "npx",
          args: ["semantic-release"],
          progress: 100,
          options: {
            localDir: directory
          }
        })
      );
    }
  }

  return steps;
}
