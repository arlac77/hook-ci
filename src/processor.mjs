import { join } from "path";
import execa from "execa";
import { createContext } from "expression-expander";
import { streamIntoJob } from "./util.mjs";

export const defaultProcessorConfig = {};

export async function processJob(job, bus, queue) {
  const config = bus.config;
  const data = job.data;
  const wd = join(config.workspace.dir, data.wd);

  data.node = config.nodename;

  function evaluate(expression) {
    expression = expression.trim();
    if (expression === "workspaceDirectory") {
      return wd;
    }

    return expression;
  }

  const eeContext = createContext({
    leftMarker: "{{",
    rightMarker: "}}",
    markerRegexp: "{{([^}]+)}}",
    evaluate
  });

  const notificatioHandler = (type, value, lineNumber, job, step) => {
    let m = value.match(/publish\s+(.*)/);
    if (m) {
      bus.queues.publish.add({ artifact: m[1], wd, node: config.nodename });
    } else {
      console.log("NOTIFICATION", value);
    }
  };

  if (Array.isArray(data.steps)) {
    for (const step of data.steps) {
      try {
        step.node = config.nodename;
        step.started = Date.now();
        const process = executeStep(step, queue, job, eeContext, notificatioHandler);

        await process;
      } catch (e) {
        step.error = e;
        step.ok = false;
        console.log(`${job.id}.${step.name}: failed`, e);
      } finally {
        step.ended = Date.now();
        job.update(data);
        if (!step.ok) {
          console.log(`${job.id}.${step.name}: terminate sequence`);
          break;
        }
      }
    }
  } else {
    console.log(`${job.id}: no steps to execute`);
  }

  return data;
}

export async function executeStep(step, queue, job, eeContext, notificatioHandler) {
  if (step.executable) {
    const executable = eeContext.expand(step.executable);
    const args = eeContext.expand(step.args);
    const options = eeContext.expand({
      forceKillAfterTimeout: 2000,
      ...step.options
    });

    let logs = await queue.getJobLogs(job.id,0,0);
    step.logStart = logs.count;

    console.log(`${job.id}.${step.name}: ${executable} ${args.join(" ")}`);
    job.log(`### ${step.name}: ${executable} ${args.join(" ")}`);
    let proc = execa(executable, args, options);

    streamIntoJob(proc.stdout, job, step, notificatioHandler);
    streamIntoJob(proc.stderr, job, step, notificatioHandler);

    let timeout = setTimeout(() => {
      timeout = undefined;
      console.log(
        `timeout (${step.timeout / 1000.0}s) waiting for ${step.executable}`
      );
      try { 
        proc.cancel();
      }
      catch(e) {
        console.log(e);
        console.log(proc);
      }
      step.ok = false;
    }, step.timeout);

    proc = await proc;
    step.exitCode = proc.exitCode;
    step.ok = step.exitCode === 0;

    console.log(
      `${job.id}.${step.name}: end ${step.exitCode} (${
        step.ok ? "OK" : "NOT OK"
      })`
    );

    logs = await queue.getJobLogs(job.id,0,0);
    step.logEnd = logs.count;

    if (timeout) {
      clearTimeout(timeout);
    }

    return proc;
  }
}
