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
      clean: 86400000,
      removeAfterPropagation: true,
      propagate: {
        failed: "investigate",
        completed: "process"
      }
    },
    investigate: {
      active: false,
      clean: 86400000,
      propagate: {
        completed: "cleanup"
      }
    },
    process: {
      active: true,
      clean: 86400000,
      propagate: {
        failed: "investigate",
        completed: "cleanup"
      }
    },
    publish: {
      active: false,
      clean: 86400000
    },
    cleanup: {
      active: true,
      clean: 86400000
    },
    "process-{{platform}}-{{arch}}": {
      active: true,
      clean: 86400000,
      propagate: {
        failed: "investigate",
        completed: "cleanup"
      },
      combinations: [
        { arch: "arm64", platform: "linux" },
        { arch: "arm", platform: "linux" },
        { arch: "x64", platform: "linux" }
      ],
      type: "process"
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
  investigate: investigateJob
};

export function queueDefinitions(queues) {
  return Object.entries(queues).reduce((all, [name, queue]) => {
    if (queue.combinations) {
      all.push(
        ...queue.combinations.map(c => {
          const n = name.replace(
            /\{\{(\w+)\}\}/g,
            (match, key, offset, string) => c[key]
          );

          delete queue.combinations;
          return {
            propagate: {},
            ...queue,
            ...c,
            name: n
          };
        })
      );
    } else {
      queue.name = name;
      all.push({ type: name, propagate: {}, ...queue });
    }

    return all;
  }, []);
}

export async function initializeQueues(bus) {
  const config = bus.config;

  const client = new Redis(config.redis.url);
  client.setMaxListeners(30);
  const subscriber = new Redis(config.redis.url);
  subscriber.setMaxListeners(30);
  const other = new Redis(config.redis.url);
  other.setMaxListeners(30);

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

  bus.queues = {};

  for (const queueDef of queueDefinitions(config.queues)) {
    const queue = new Queue(queueDef.name, queueOptions);
    bus.queues[queueDef.name] = queue;
    if (queueDef.clean !== undefined) {
      queue.clean(queueDef.clean);
    }

    if (queueDef.active) {
      if (queueDef.os && process.arch !== queueDef.arch) {
        console.log(
          `Skip processing ${queueDef.name} not the right arch ${process.arch}!=${queueDef.arch}`
        );
      } else if (queueDef.platform && process.platform !== queueDef.platform) {
        console.log(
          `Skip processing ${queueDef.name} not the right platform ${process.platform}!=${queueDef.platform}`
        );
      } else {
        const qt = queueTypes[queueDef.type];
        if (qt) {
          queue.process(async job => qt(job, bus, queue));
        } else {
          console.log(`Unknown queue type ${queueDef.type}`);
        }
      }
    }

    queue.on("error", error => console.log("ERROR", error));

    const propagator = state => {
      return async (job, result) => {
        console.log(`${job.id}: ${state}`);
        if (result === undefined) {
          return;
        }

        if (queueDef.propagate[state]) {
          console.log(`${job.id}: propagate to`, queueDef.propagate[state]);
          const dest = bus.queues[queueDef.propagate[state]];
          await dest.add(state === "failed" ? job.data : result);
          if (queueDef.removeAfterPropagation) {
            await job.remove();
          }
        } else {
          //console.log(`${job.id}: ${state} no propagation destination queue`);
        }

        if (queueDef.clean !== undefined) {
          queue.clean(queueDef.clean);
        }
      };
    };

    ["completed", "failed"].forEach(state =>
      queue.on(state, propagator(state))
    );
  }
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
  const data = job.data;

  if (data === undefined || Object.keys(data).length === 0) {
    // ok nothing to do
  } else {
    throw new Error(`Unable to investigate`);
  }
}
