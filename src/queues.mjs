import fs from "fs";
import Queue from "bull";
import Redis  from 'ioredis';

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
  publish: publishJob
};

export async function initializeQueues(bus) {
  const config = bus.config;

  const client = new Redis(config.redis.url);
  client.setMaxListeners(20);
  const subscriber = new Redis(config.redis.url);
  subscriber.setMaxListeners(20);

  const queueOptions = {
    createClient(type) {
      switch (type) {
        case 'client':
          return client;
        case 'subscriber':
          return subscriber;
        default:
          return new Redis();
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
  if (job.data.node !== bus.config.nodename) {
    throw new Error(
      `Unable to cleanup on ${bus.config.nodename} need to be run on ${job.data.node}`
    );
  }

  const wd = job.data.wd;
  if (wd !== undefined) {
    await fs.promises.rmdir(wd, { recursive: true });
    /*const proc = await execa("rm", ["-rf", wd]);
    streamIntoJob(proc.stdout, job);
    streamIntoJob(proc.stderr, job);
    */
  }
}

async function publishJob(job, bus) {}
