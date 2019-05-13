import { join, dirname } from "path";
import { utf8Encoding, createStep } from "./util.mjs";

const wellKnownScripts = new Set([
  "install",
  "test",
  "pack",
  "version",
  "publish"
]);

function scriptArgs(name) {
  return wellKnownScripts.has(name) ? [name] : ["run", name];
}

export async function npmAnalyse(branch, job, config, wd) {
  const steps = [];
  const requirements = [];

  for await (const entry of branch.entries([
    "**/package.json",
    ...config.analyse.skip
  ])) {
    const json = JSON.parse(await (await branch.entry(entry.name)).getString());
    const directory = dirname(entry.name);

    if (json.engines) {
      if (json.engines.node) {
        requirements.push({
          executable: "node",
          version: json.engines.node
        });
      }
    }

    steps.push(
      createStep({
        name: "prepare",
        directory,
        executable: "npm",
        args: scriptArgs("install"),
        requirements
      })
    );

    if (json.scripts) {
      if (json.scripts.cover) {
        steps.push(
          createStep({
            name: "test",
            directory,
            executable: "npm",
            args: scriptArgs("cover"),
            requirements
          })
        );
      } else if (json.scripts.test) {
        steps.push(
          createStep({
            name: "test",
            directory,
            executable: "npm",
            args: scriptArgs("test"),
            requirements
          })
        );
      }
      if (json.scripts.docs) {
        steps.push(
          createStep({
            name: "documentation",
            directory,
            executable: "npm",
            args: scriptArgs("docs"),
            requirements
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
          },
          requirements
        })
      );
    }
  }

  return steps;
}
