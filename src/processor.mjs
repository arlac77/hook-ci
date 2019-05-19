import { join } from "path";
import fs, { createWriteStream } from "fs";
import execa from "execa";
import { utf8Encoding, streamIntoJob } from "./util.mjs";

export const defaultProcessorConfig = {};

export async function processJob(job, config, queues, repositories) {
  const data = job.data;
  const wd = data.wd;

  if (Array.isArray(data.steps)) {
    for (const step of data.steps) {
      try {
        step.started = new Date();
        const process = await executeStep(step, job, wd);
      } catch (e) {
        step.error = e;
        console.log(`${job.id}.${step.name}: failed`, e);
      } finally {
        step.ended = new Date();
        job.update(data);
      }
    }
  } else {
    console.log(`${job.id}: no steps to execute`);
  }

  return data;
}

export async function executeStep(step, job, wd) {
  if (step.executable) {
    console.log(
      `${job.id}.${step.name}: ${step.executable} ${step.args.join(" ")}`
    );
    job.log(`${step.executable} ${step.args.join(" ")}`);
    let proc = execa(step.executable, step.args, step.options);

    streamIntoJob(proc.stdout, job);
    streamIntoJob(proc.stderr, job);

    proc = await proc;
    console.log(`${job.id}.${step.name}: end ${proc.code}`);
    step.code = proc.code;

    return proc;
  }
}
