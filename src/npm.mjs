import { utf8Encoding } from "./util";
import { join } from "path";
import { createWriteStream } from "fs";
import execa from "execa";

export async function runNpm(job, wd, dir) {
  const pkgDir = join(wd, dir);

  async function e(scriptName) {
    const wellKnownScripts = new Set(["install", "test", "publish"]);
    args = wellKnownScripts.has(scriptName)
      ? [scriptName]
      : ["run", scriptName];
    const proc = execa("npm", [scriptName], { cwd: pkgDir });
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
