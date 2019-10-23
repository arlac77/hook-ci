import fs from "fs";
import { join } from "path";
import Queue from "bull";
import Redis from "ioredis";

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
    publish: {
      active: false,
      clean: 36000000
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
  process: processJob,
  publish: publishJob,
  investigate: investigateJob,
};

export async function initializeQueues(bus) {
  const config = bus.config;

  const client = new Redis(config.redis.url);
  client.setMaxListeners(20);
  const subscriber = new Redis(config.redis.url);
  subscriber.setMaxListeners(20);
  const other = new Redis(config.redis.url);
  other.setMaxListeners(20);

  const queueOptions = {
    createClient(type) {
      switch (type) {
        case "client":
          return client;
        case "subscriber":
          return subscriber;
        default:
          return other;
      }
    }
  };

  const queues = Object.keys(config.queues).reduce((queues, name) => {
    queues[name] = new Queue(name, queueOptions);
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
        if (cq.clean !== undefined) {
          queue.clean(cq.clean);
        }

        queue.process(async job => qt(job, bus));

        queue.on("error", error => {
          console.log("ERROR", error);
        });

        const propagator = event => {
          return (job, result) => {
            console.log(`${job.id}: ${event}`, result);
            if (result === undefined) {
              return;
            }

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

  bus.queues = queues;
}

async function cleanupJob(job, bus) {
  const config = bus.config;
  const data = job.data;

  if (data.node !== bus.config.nodename) {
    throw new Error(
      `Unable to cleanup on ${bus.config.nodename} need to be run on ${data.node}`
    );
  }

  const wd = data.wd;
  if (wd !== undefined) {
    await fs.promises.rmdir(join(config.workspace.dir, wd), {
      recursive: true
    });
  }
}

async function publishJob(job, bus) {}

async function investigateJob(job, bus) {
  const config = bus.config;
  const data = job.data;

  if(data === undefined || Object.keys(data).length === 0) {
    // ok nothing to do
  }
  else {
    throw new Error(`Unable to investigate`);
  }
}
