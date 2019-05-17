import Queue from "bull";
import execa from "execa";

import { processJob } from "./processor.mjs";
import { analyseJob } from "./analyser.mjs";

/**
 * default configuration for queues
 */
export const defaultQueuesConfig = {
  redis: { url: "${first(env.REDIS_URL,'redis://127.0.0.1:6379')}" },
  queues: {
    incoming: {
      active: true,
      propagate: {
        failure: "investigate",
        success: "process"
      }
    },
    investigate: {
      active: false
    },
    process: {
      active: true,
      propagate: {
        failure: "investigate",
        success: "cleanup"
      }
    },
    cleanup: {
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

        queue.on("completed", (job, result) => {
          console.log("COMPLETED", job, result);
          if (cq.propagate && cq.propagate.success) {
            console.log("PROPAGATE TO", cq.propagate.success);
            const dest = queues[cq.propagate.success];
            dest.add({ ...job.data, result });
          }
        });

        queue.on("failed", (job, error) => {
          console.log("FAILED", job, error);
          if (cq.propagate && cq.propagate.failure) {
            console.log("PROPAGATE TO", cq.propagate.failure);
            const dest = queues[cq.propagate.failure];
            dest.add({ ...job.data, error });
          }
        });
      }
    }
  });

  return queues;
}

async function cleanupJob(job, config, queues, repositories) {
  queues.incoming.clean(5000);

  if (job.data.wd) {
    console.log(`rm -rf ${wd}`);

    //const proc = await execa("rm", ["-rf", wd]);
  }
}
