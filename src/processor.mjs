import { join } from "path";
import fs, { createWriteStream } from "fs";
import execa from "execa";
import { utf8Encoding } from "./util.mjs";

export const defaultProcessorConfig = {};

export async function processJob(job, config, queues, repositories) {
  const data = job.data;
  const wd = data.wd;

  const options = { logFile: false };

  for (const step of data.steps) {
    try {
      console.log(`${job.id}: start ${step.name} (${wd})`);
      const process = await executeStep(step, job, wd, options);
      options.logFile = true;
      console.log(`${job.id}: end ${step.name} ${process.code}`);
    } catch (e) {
      console.log(`${job.id}: failed ${step.name}`, e);
    }
  }
}

export async function executeStep(step, job, wd, options = { logFile: true }) {
  if (step.executable) {
    const cwd = step.directory !== undefined ? join(wd, step.directory) : wd;
    const name = step.name.replace(/\s+/, "_");

    console.log(`${job.id}: ${step.executable} ${step.args.join(" ")}`);
    const proc = execa(step.executable, step.args, { cwd, ...step.options });

    if (options.logFile) {
      proc.stdout.pipe(
        createWriteStream(join(wd, `${name}.stdout.log`), utf8Encoding)
      );
      proc.stderr.pipe(
        createWriteStream(join(wd, `${name}.stderr.log`), utf8Encoding)
      );
    }

    return proc;
  }
}
