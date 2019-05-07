import { createServer as httpCreateServer } from "http";
import { createServer as httpsCreateServer } from "https";
import Koa from "koa";
import Router from "koa-better-router";
import { createGithubHookHandler } from "koa-github-hook-handler";

export async function createServer(config, sd, queues) {
  const app = new Koa();

  const server = config.http.cert
    ? httpsCreateServer(config.http, app.callback())
    : httpCreateServer(app.callback());
  server.on("error", err => console.log(err));
  const router = Router();

  router.addRoute("GET", "/state", async (ctx, next) => {
    const q = await Promise.all(
      Object.keys(queues).map(async name => {
        const queue = queues[name];
        return {
          name,
          active: await queue.getActiveCount(),
          waiting: await queue.getWaitingCount(),
          paused: await queue.getPausedCount(),
          completed: await queue.getCompletedCount(),
          failed: await queue.getFailedCount(),
          delayed: await queue.getDelayedCount()
        };
      })
    );

    ctx.body = {
      version: config.version,
      queues: q
    };
    return next();
  });

  router.addRoute(
    "POST",
    config.http.hook.path,
    createGithubHookHandler(
      {
        push: async request => {
          await queues.request.add(request);
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
