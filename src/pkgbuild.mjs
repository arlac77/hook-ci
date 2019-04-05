import { utf8Encoding } from "./util";
import { join } from "path";
import { createWriteStream } from "fs";
import execa from "execa";

export async function pkgbuild(job, wd, dir) {
  const pkgDir = join(wd, dir);
  const proc = execa("makepkg", [], { cwd: pkgDir });

  proc.stdout.pipe(
      createWriteStream(join(wd, `${scriptName}.stdout.log`), utf8Encoding)
  );

  proc.stderr.pipe(
    createWriteStream(join(wd, `${scriptName}.stderr.log`), utf8Encoding)
  );
  await proc;

  job.progress(100);
}
