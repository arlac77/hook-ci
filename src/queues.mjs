import Queue from "bull";
import execa from "execa";

import { processJob } from "./processor.mjs";
import { analyseJob } from "./analyser.mjs";
import { streamIntoJob } from "./util.mjs";

/**
 * default configuration for queues
 */
export const defaultQueuesConfig = {
  redis: { url: "${first(env.REDIS_URL,'redis://127.0.0.1:6379')}" },
  queues: {
    incoming: {
      active: true,
      clean: 36000000,
      propagate: {
        failed: "investigate",
        completed: "process"
      }
    },
    investigate: {
      active: false,
      propagate: {
        completed: "cleanup"
      }
    },
    process: {
      active: true,
      clean: 36000000,
      propagate: {
        failed: "investigate",
        completed: "cleanup"
      }
    },
    cleanup: {
      clean: 36000000,
      active: true
    }
  }
};

/**
 * map queue names
 * to processing
 */
const queueTypes = {
  incoming: analyseJob,
  cleanup: cleanupJob,
  process: processJob
};

export async function createQueues(config, repositories) {
  const queues = Object.keys(config.queues).reduce((queues, name) => {
    queues[name] = new Queue(name, config.redis.url);
    return queues;
  }, {});

  Object.keys(config.queues).forEach(name => {
    const cq = config.queues[name];
    if (cq.active) {
      const queue = queues[name];
      const qt = queueTypes[name];
      if (qt === undefined) {
        console.log(`no queue type for ${name}`);
      } else {
        queue.process(async job => qt(job, config, queues, repositories));

        queue.on("error", error => {
          console.log("ERROR", error);
        });

        const propagator = event => {
          return (job, result) => {
            console.log(`${job.id}: ${event}`, result);
            if(result === undefined) { return; }

            if (cq.propagate && cq.propagate[event]) {
              console.log(`${job.id}: propagate to`, cq.propagate[event]);
              const dest = queues[cq.propagate[event]];
              dest.add(result);
            } else {
              console.log(
                `${job.id}: ${event} no propagation destination queue`
              );
            }

            if (cq.clean !== undefined) {
              queue.clean(cq.clean);
            }
          };
        };

        ["completed", "failed"].forEach(state =>
          queue.on(state, propagator(state))
        );
      }
    }
  });

  return queues;
}

async function cleanupJob(job, config, queues, repositories) {
  const wd = job.data.wd;
  if (wd !== undefined) {
    const proc = await execa("rm", ["-rf", wd]);
    streamIntoJob(proc.stdout, job);
    streamIntoJob(proc.stderr, job);
  }
}
