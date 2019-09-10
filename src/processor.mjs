import execa from "execa";
import { streamIntoJob } from "./util.mjs";

export const defaultProcessorConfig = {};

export async function processJob(job, bus) {
  const data = job.data;
  const wd = data.wd;

  const notificatioHandler = body => {
    const m = body.match(/publish\s+(.*)/);
    if (m) {
      console.log("PUBLISH", m[1]);
      bus.publush.add({ artifact: m[1], wd });
    } else {
      console.log("NOTIFICATION", body);
    }
  };

  if (Array.isArray(data.steps)) {
    for (const step of data.steps) {
      try {
        step.node = bus.config.nodename;
        step.started = Date.now();
        const process = executeStep(step, job, wd);

        await process;
      } catch (e) {
        step.error = e;
        console.log(`${job.id}.${step.name}: failed`, e);
      } finally {
        step.ended = Date.now();
        job.update(data);
      }
    }
  } else {
    console.log(`${job.id}: no steps to execute`);
  }

  return data;
}

export async function executeStep(step, job, notificatioHandler) {
  if (step.executable) {
    console.log(
      `${job.id}.${step.name}: ${step.executable} ${step.args.join(" ")}`
    );
    job.log(`### ${step.name}: ${step.executable} ${step.args.join(" ")}`);
    let proc = execa(step.executable, step.args, step.options);

    streamIntoJob(proc.stdout, job, notificatioHandler);
    streamIntoJob(proc.stderr, job, notificatioHandler);

    let timeout = setTimeout(() => {
      timeout = undefined;
      console.log(`timeout waiting for ${step.executable}`);
      proc.cancel();
    }, step.timeout);

    proc = await proc;
    step.exitCode = proc.exitCode;

    console.log(`${job.id}.${step.name}: end ${step.exitCode}`);

    if (timeout) {
      clearTimeout(timeout);
    }

    return proc;
  }
}
