import { join } from "path";
import { createWriteStream } from "fs";
import execa from "execa";
import { utf8Encoding } from "./util.mjs";

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
