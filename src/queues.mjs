import { executeJob } from "processor.mjs";

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

  queues.cleanup.process(async job => {
    queues.incoming.clean(5000);
    queue.cleanup.clean(5000);

    if (job.data.after) {
      const wd = join(config.workspace.dir, job.data.after);

      console.log(`rm -rf ${wd}`);

      //const proc = await execa("rm", ["-rf", wd]);
    }
  });

  if (config.queues.incoming.active) {
    queues.incoming.process(async job => {
      try {
        const result = await startJob(job);
        queues.cleanup.add(job.data);
        return result;
      } catch (e) {
        console.log(e);
        queues.error.add(Object.assign({ error: e }, job.data));
        throw e;
      }
    });
  }

  return queues;
}
