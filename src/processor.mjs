import execa from "execa";
import { createContext } from "expression-expander";
import { streamIntoJob } from "./util.mjs";

export const defaultProcessorConfig = {};

export async function processJob(job, bus) {
  const data = job.data;
  const wd = join(config.workspace.dir,data.wd);

  data.node = bus.config.nodename;

  function evaluate(expression) {
    expression = expression.trim();
    if (expression === 'workspaceDirectory') {
      return wd;
    }

    return expression;
  }

  const eeContext = createContext({
    leftMarker: '{{',
    rightMarker: '}}',
    markerRegexp: '{{([^}]+)}}',
    evaluate
  });

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
        const process = executeStep(step, job, eeContext, notificatioHandler);

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

export async function executeStep(step, job, eeContext, notificatioHandler) {
  if (step.executable) {
    const executable = eeContext.expand(step.executable);
    const args = eeContext.expand(step.args);
    const options = eeContext.expand(step.options);

    console.log(
      `${job.id}.${step.name}: ${executable} ${args.join(" ")}`
    );
    job.log(`### ${step.name}: ${executable} ${args.join(" ")}`);
    let proc = execa(executable, args, options);

    streamIntoJob(proc.stdout, job, notificatioHandler);
    streamIntoJob(proc.stderr, job, notificatioHandler);

    let timeout = setTimeout(() => {
      timeout = undefined;
      console.log(`timeout waiting for ${step.executable}`);
      proc.cancel();
      step.ok = false;
    }, step.timeout);

    proc = await proc;
    step.exitCode = proc.exitCode;
    step.ok = step.exitCode === 0;

    console.log(`${job.id}.${step.name}: end ${step.exitCode} (${step.ok ? 'OK' : 'NOT OK'})`);
    if (timeout) {
      clearTimeout(timeout);
    }

    return proc;
  }
}
