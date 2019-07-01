import { join, dirname } from "path";
import { createStep } from "./util.mjs";

/**
 * npm buildin scripts
 */
const wellKnownScripts = new Set([
  "ci",
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
    ...config.analyse.entries.exclude
  ])) {
    const json = JSON.parse(await entry.getString());
    const directory = dirname(entry.name);
    const options = { cwd: join(wd, directory) };

    if (json.engines) {
      if (json.engines.node) {
        requirements.push({
          executable: "node",
          version: json.engines.node
        });
      }
    }
    
    if (json.cpu) {
      json.cpu.forEach(cpu => {
        requirements.push({ cpu });
      });
    }

    if (json.os) {
      json.os.forEach(os => {
        requirements.push({ os });
      });
    }

    const packageLock = await branch.maybeEntry(entry.name.replace(/.json$/, '-lock.json'));

    steps.push(
      createStep({
        name: "prepare",
        executable: "npm",
        args: scriptArgs(packageLock === undefined ? "install" : "ci"),
        options,
        requirements
      })
    );

    if (json.scripts) {
      if (json.scripts.cover) {
        steps.push(
          createStep({
            name: "test",
            executable: "npm",
            args: scriptArgs("cover"),
            options,
            requirements
          })
        );
      } else if (json.scripts.test) {
        steps.push(
          createStep({
            name: "test",
            executable: "npm",
            args: scriptArgs("test"),
            options,
            requirements
          })
        );
      }
      if (json.scripts.lint) {
        steps.push(
          createStep({
            name: "lint",
            executable: "npm",
            args: scriptArgs("lint"),
            options,
            requirements
          })
        );
      }
      if (json.scripts.docs) {
        steps.push(
          createStep({
            name: "documentation",
            executable: "npm",
            args: scriptArgs("docs"),
            options,
            requirements
          })
        );

        if (json.scripts.docs.match(/documentation\s+readme/)) {
          // make pull request adding differences README.md
        }
      }
    }

    if (json.devDependencies && json.devDependencies["semantic-release"]) {
      steps.push(
        createStep({
          name: "deploy",
          executable: "npx",
          args: ["semantic-release"],
          options: {
            ...options,
            localDir: options.cwd
          },
          requirements
        })
      );
    }
  }

  return steps;
}
