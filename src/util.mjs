import { join } from "path";
import fs, { createWriteStream } from "fs";
import execa from "execa";

export const utf8Encoding = { encoding: "utf8" };

export function createStep(step) {
  step.execute = async (job, wd) => {
    console.log(job);
    console.log(wd);

    const cwd = join(wd, step.directory);

    console.log(`${step.executable} (${cwd})`);
    const proc = execa(
      step.executable,
      step.args,
      Object.assign({ cwd }, step.options)
    );
    proc.stdout.pipe(
      createWriteStream(join(wd, `${step.name}.stdout.log`), utf8Encoding)
    );
    proc.stderr.pipe(
      createWriteStream(join(wd, `${step.name}.stderr.log`), utf8Encoding)
    );

    job.progress(step.progress);

    return proc;
  };

  return step;
}
