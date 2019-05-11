import { join, dirname } from "path";
import { utf8Encoding, createStep } from "./util.mjs";

const wellKnownScripts = new Set(["install", "test", "pack", "version", "publish"]);

function scriptArgs(name)
{
  return wellKnownScripts.has(name) ? [name] : ['run', name];
}

export async function npmAnalyse(branch, job, config,wd) {
  const steps = [];

  for await (const entry of branch.entries(["**/package.json", ...config.analyse.skip])) {
    const json = JSON.parse(await (await branch.entry(entry.name)).getString());
    const directory = dirname(entry.name);

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
        args: scriptArgs('install')
      })
    );

    if (json.scripts) {
      if (json.scripts.cover) {
        steps.push(
          createStep({
            name: "test",
            directory,
            executable: "npm",
            args: scriptArgs('cover')
          })
        );
      }
      else if (json.scripts.test) {
        steps.push(
          createStep({
            name: "test",
            directory,
            executable: "npm",
            args: scriptArgs('test')
          })
        );
      }
      if (json.scripts.docs) {
        steps.push(
          createStep({
            name: "test",
            directory,
            executable: "npm",
            args: scriptArgs('docs')
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
          options: {
            localDir: directory
          }
        })
      );
    }
  }

  return steps;
}
