import { join, dirname } from "path";
import fs, { createWriteStream } from "fs";
import execa from "execa";
import globby from "globby";
import { utf8Encoding, createStep } from "./util.mjs";

const wellKnownScripts = new Set(["install", "test", "publish"]);

export async function runNpm(job, wd, dir) {
  const pkgDir = join(wd, dir);

  async function e(scriptName) {
    const args = wellKnownScripts.has(scriptName)
      ? [scriptName]
      : ["run", scriptName];

    console.log(`npm ${args.join(" ")}`);

    const proc = execa("npm", args, { cwd: pkgDir });
    proc.stdout.pipe(
      createWriteStream(join(wd, `${scriptName}.stdout.log`), utf8Encoding)
    );
    proc.stderr.pipe(
      createWriteStream(join(wd, `${scriptName}.stderr.log`), utf8Encoding)
    );
    await proc;
  }

  job.progress(10);

  await e("install");
  job.progress(30);

  await e("test");
  job.progress(80);

  await e("package");
  job.progress(100);
}

export async function npmAnalyse(wd) {
  const steps = [];

  for (const pkg of await globby(["**/package.json"], { cwd: wd })) {
    const file = join(wd, pkg);
    const json = JSON.parse(await fs.promises.readFile(file, utf8Encoding));

    const directory = dirname(pkg);

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
      if (json.scripts.test) {
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
    }

    if (json.devDependencies && json.devDependencies["semantic-release"]) {
      steps.push(
        createStep({
          name: "deploy",
          directory,
          executable: "npx",
          args: ["semantic-release"],
          progress: 100
        })
      );
    }
  }

  return steps;
}
