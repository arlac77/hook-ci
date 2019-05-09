import Queue from "bull";
import execa from "execa";

import { processJob } from "processor.mjs";

export const defaultQueuesConfig = {
  redis: { url: "${first(env.REDIS_URL,'redis://127.0.0.1:6379')}" },
  queues: {
    incoming: {
      active: true
    },
    investigate: {
      active: false
    },
    dispatch: {
      active: true
    },
    process: {
      active: true
    },
    cleanup: {
      active: true
    }
  }
};

export async function createQueues(config) {
  const queues = Object.keys(config.queues).reduce((queues, name) => {
    queues[name] = new Queue(name, config.redis.url);
    return queues;
  }, {});

  Object.keys(config.queues).forEach(name => {
    if (config.queues[name].active) {
      const queue = queues[name];
      switch (name) {
        case "cleanup":
          queue.process(async job => cleanupJob(job, config, queues));
          break;
        case "incoming":
          queue.process(async job => analyseJob(job, config, queues));
          break;
        case "process":
          queue.process(async job => processJob(job, config, queues));
          break;
      }
    }
  });

  return queues;
}

async function cleanupJob(job, config, queues) {
  queues.incoming.clean(5000);

  if (job.data.after) {
    const wd = join(config.workspace.dir, job.data.after);

    console.log(`rm -rf ${wd}`);

    //const proc = await execa("rm", ["-rf", wd]);
  }
}
