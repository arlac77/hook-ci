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
      console.log(`${job.id}: end ${step.name} ${process.code}`);
    } catch (e) {
      console.log(`${job.id}: failed ${step.name}`, e);
    }
  }
}

export async function executeStep(step, job, wd, options = { logFile: true }) {
  if (step.executable) {
    const name = step.name.replace(/\s+/, "_");

    console.log(`${job.id}: ${step.executable} ${step.args.join(" ")}`);
    const proc = execa(step.executable, step.args, step.options);

    proc.stdout.on("data", chunk => {
      job.log(chunk.toString('utf8'));
    });
    proc.stderr.on("data", chunk => {
      job.log(chunk.toString('utf8'));
    });

    return proc;
  }
}
