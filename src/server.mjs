import { createServer as httpCreateServer } from "http";
import { createServer as httpsCreateServer } from "https";
import Koa from "koa";
import Router from "koa-better-router";
import { createHooks } from "./hooks.mjs";

export const defaultServerConfig = {
  http: {
    port: "${first(env.PORT,8093)}",
    hooks: {
      gitea: {
        path: "/gitea",
        secret: "${env.WEBHOOK_SECRET}",
        queue: "incoming"
      },
      github: {
        path: "/webhook",
        secret: "${env.WEBHOOK_SECRET}",
        queue: "incoming"
      }
    }
  }
};

async function queueDetails(name, queue) {
  return {
    name,
    active: await queue.getActiveCount(),
    waiting: await queue.getWaitingCount(),
    paused: await queue.getPausedCount(),
    completed: await queue.getCompletedCount(),
    failed: await queue.getFailedCount(),
    delayed: await queue.getDelayedCount()
  };
}

function getQueue(queues, name, ctx) {
  const queue = queues[name];
  if (!queue) {
    ctx.throw(500, `Queue ${name} not found`);
  }

  return queue;
}


export async function createServer(config, sd, queues, repositories) {
  const app = new Koa();

  const server = config.http.cert
    ? httpsCreateServer(config.http, app.callback())
    : httpCreateServer(app.callback());
  server.on("error", err => console.log(err));
  const router = Router();

  router.addRoute("GET", "/authorize", async (ctx, next) => {
    body = {
      ...config.oauth2
    };
    return next();
  });


  router.addRoute("GET", "/state", async (ctx, next) => {
    ctx.body = [
      {
        name: config.nodename,
        version: config.version,
        versions: process.versions,
        platform: process.platform,
        uptime: process.uptime(),
        memory: process.memoryUsage()
      }
    ];
    return next();
  });

  router.addRoute("GET", "/repositories", async (ctx, next) => {
    const rs = [];

    for await (const repository of repositories.repositories(
      ctx.query.pattern || "*"
    )) {
      rs.push(repository.toJSON());
    }

    ctx.body = rs;

    return next();
  });

  router.addRoute("GET", "/queues", async (ctx, next) => {
    ctx.body = await Promise.all(
      Object.keys(queues).map(async name => {
        const queue = queues[name];
        return queueDetails(name, queue);
      })
    );
    return next();
  });

  router.addRoute("GET", "/queue/:queue", async (ctx, next) => {
    ctx.body = await queueDetails(
      ctx.params.queue,
      getQueue(queues, ctx.params.queue, ctx)
    );
    return next();
  });

  router.addRoute("POST", "/queue/:queue/pause", async (ctx, next) => {
    const queue = getQueue(queues, ctx.params.queue, ctx);
    await queue.pause();
    ctx.body = {};
    return next();
  });

  router.addRoute("POST", "/queue/:queue/resume", async (ctx, next) => {
    const queue = getQueue(queues, ctx.params.queue, ctx);
    await queue.resume();
    ctx.body = {};
    return next();
  });

  router.addRoute("POST", "/queue/:queue/empty", async (ctx, next) => {
    const queue = getQueue(queues, ctx.params.queue, ctx);
    await queue.empty();
    ctx.body = {};
    return next();
  });

  router.addRoute("GET", "/queue/:queue/jobs", async (ctx, next) => {
    //ctx.query.states;
    const queue = getQueue(queues, ctx.params.queue, ctx);
    ctx.body = (await queue.getJobs(
      [
        "active",
        "waiting",
        "completed",
        "paused",
        "failed",
        "delayed"
      ] /*, { asc: true }*/
    )).map(job => {
      return {
        id: job.id,
        attemptsMade: job.attemptsMade,
        processedOn: job.processedOn,
        finishedOn: job.processedOn,
        ...job.data
      };
    });
    return next();
  });

  router.addRoute(
    "POST",
    "/queue/:queue/job/:job/cancel",
    async (ctx, next) => {
      const queue = getQueue(queues, ctx.params.queue, ctx);
      //const job = await queue.getJob(ctx.params.job);
      ctx.throw(500, `Unable to cancel job ${ctx.params.job}`);

      return next();
    }
  );

  router.addRoute("GET", "/queue/:queue/job/:job", async (ctx, next) => {
    const queue = getQueue(queues, ctx.params.queue, ctx);
    const job = await queue.getJob(ctx.params.job);
    //console.log(job);
    ctx.body = {
      id: job.id,
      state: await job.getState(),
      attemptsMade: job.attemptsMade,
      processedOn: job.processedOn,
      finishedOn: job.processedOn,
      ...job.data
    };
    return next();
  });

  router.addRoute("GET", "/queue/:queue/job/:job/log", async (ctx, next) => {
    const queue = getQueue(queues, ctx.params.queue, ctx);
    ctx.body = await queue.getJobLogs(
      ctx.params.job,
      ctx.query.start,
      ctx.query.end
    );
    return next();
  });

  createHooks(config.http.hooks, router, queues);

  app.use(router.middleware());

  const listener = app.listen(config.http.port, () => {
    console.log("listen on", listener.address());
    sd.notify("READY=1\nSTATUS=running");
  });

  return server;
}
