import { createServer as httpCreateServer } from "http";
import { createServer as httpsCreateServer } from "https";
import Koa from "koa";
import Router from "koa-better-router";
import { createGithubHookHandler } from "koa-github-hook-handler";
import { stripUnusedDataFromHookRequest } from "./util.mjs";


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

export async function createServer(config, sd, queues) {
  const app = new Koa();

  const server = config.http.cert
    ? httpsCreateServer(config.http, app.callback())
    : httpCreateServer(app.callback());
  server.on("error", err => console.log(err));
  const router = Router();

  router.addRoute("GET", "/state", async (ctx, next) => {
    ctx.body = {
      version: config.version,
      versions: process.versions,
      uptime: process.uptime(),
      memory: process.memoryUsage()
    };
    return next();
  });

  router.addRoute("GET", "/queues", async (ctx, next) => {
    ctx.body = await Promise.all(
      Object.keys(queues).map(async name => {
        const queue = queues[name];
        return queueDetails(name,queue);
      })
    );
    return next();
  });

  router.addRoute("GET", "/queue/:queue", async (ctx, next) => {
    ctx.body = await queueDetails(ctx.params.queue,queues[ctx.params.queue]);
    return next();
  });

  router.addRoute("POST", "/queue/:queue/pause", async (ctx, next) => {
    const queue = queues[ctx.params.queue];
    await queue.pause();
    ctx.body = {};
    return next();
  });

  router.addRoute("POST", "/queue/:queue/resume", async (ctx, next) => {
    const queue = queues[ctx.params.queue];
    await queue.resume();
    ctx.body = {};
    return next();
  });

  router.addRoute("GET", "/queue/:queue/jobs", async (ctx, next) => {
    const queue = queues[ctx.params.queue];
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
      return { id: job.id, data: job.data };
    });
    return next();
  });

  router.addRoute(
    "POST",
    config.http.hook.path,
    createGithubHookHandler(
      {
        push: async request => {
          await queues.request.add(stripUnusedDataFromHookRequest(request));
          return { ok: true };
        },
        pull_request: async (request, event) => {
          console.log("Received a %s event for %s", event, request);
          return { ok: true };
        },
        ping: async (request, event) => {
          console.log(
            "Received a ping %s for %s",
            event,
            request.repository.full_name
          );

          const activeCount = await queues.request.getActiveCount();
          return { ok: true, activeCount };
        }
      },
      config.http.hook
    )
  );

  app.use(router.middleware());

  const listener = app.listen(config.http.port, () => {
    console.log("listen on", listener.address());
    sd.notify("READY=1\nSTATUS=running");
  });

  return server;
}
