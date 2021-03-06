import { join, dirname } from "path";
import { createStep } from "./util.mjs";

/**
 * npm buildin scripts
 */
const wellKnownScripts = new Set([
  "ci",
  "install",
  "build",
  "link",
  "test",
  "pack",
  "version",
  "prune",
  "outdate",
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
        requirements.push({ architecture: cpu });
      });
    }

    if (json.os) {
      json.os.forEach(os => {
        requirements.push({ os });
      });
    }

    const yarnLock = await branch.maybeEntry(entry.name.replace("package.json", "yarn.lock"));

    let executable = "npm";
    
    if (yarnLock) {
      executable = "yarn";
    
      steps.push(
        createStep({
          name: "prepare",
          executable,
          args: ["--ignore-engines","install"],
          options,
          requirements
        })
      );
    } else {
      const packageLock = await branch.maybeEntry(entry.name.replace(/.json$/, "-lock.json"));
  
      steps.push(
        createStep({
          name: "prepare",
          executable,
          args: scriptArgs(packageLock === undefined ? "install" : "ci"),
          options,
          requirements
        })
      );
    }

    if (json.scripts) {
      if (json.scripts.cover) {
        steps.push(
          createStep({
            name: "test",
            executable,
            args: scriptArgs("cover"),
            options,
            requirements
          })
        );
      } else if (json.scripts.test) {
        steps.push(
          createStep({
            name: "test",
            executable,
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
            executable,
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
            executable,
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
