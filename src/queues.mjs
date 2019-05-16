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
      active: true
    },
    investigate: {
      active: false
    },
    process: {
      active: true
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
    if (config.queues[name].active) {
      const queue = queues[name];
      const qt = queueTypes[name];
      if (qt === undefined) {
        console.log(`no queue type for ${name}`);
      } else {
        queue.process(async job => qt(job, config, queues, repositories));
        
        queue.on('error', (error) => {
          console.log("ERROR",error);
        });
        
        queue.on('failed', (job,error) => {
          console.log("FAILED",job,error);
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
