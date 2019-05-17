import { join } from "path";
import fs, { createWriteStream } from "fs";
import execa from "execa";
import { utf8Encoding, streamIntoJob } from "./util.mjs";

export const defaultProcessorConfig = {};

export async function processJob(job, config, queues, repositories) {
  const data = job.data;
  const wd = data.wd;

  for (const step of data.steps) {
    try {
      console.log(`${job.id}: start ${step.name} (${wd})`);
      const process = await executeStep(step, job, wd);
      console.log(`${job.id}: end ${step.name} ${process.code}`);
    } catch (e) {
      console.log(`${job.id}: failed ${step.name}`, e);
    }
  }
}

export async function executeStep(step, job, wd) {
  if (step.executable) {
    console.log(`${job.id}/${step.name}: ${step.executable} ${step.args.join(" ")}`);
    const proc = execa(step.executable, step.args, step.options);

    streamIntoJob(proc.stdout, job);
    streamIntoJob(proc.stderr, job);

    return proc;
  }
}
