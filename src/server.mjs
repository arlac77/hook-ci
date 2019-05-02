import { createServer as httpCreateServer } from "http";
import { createServer as httpsCreateServer } from "https";
import Koa from "koa";
import Router from "koa-better-router";
import { createGithubHookHandler } from "koa-github-hook-handler";

export async function createServer(config, sd, requestQueue) {
  const app = new Koa();

  const server = config.http.cert
    ? httpsCreateServer(config.http, app.callback())
    : httpCreateServer(app.callback());
  server.on("error", err => console.log(err));
  const router = Router();

  router.addRoute("GET", "/state", async (ctx, next) => {
    ctx.body = {
      version: config.version,
      queues: {
        request: {
          count: await requestQueue.count(),
          failed: (await requestQueue.getFailed()).length
        }
      }
    };
    return next();
  });

  router.addRoute(
    "POST",
    config.http.hook.path,
    createGithubHookHandler(
      {
        push: async request => {
          requestQueue.add(request);
          return { ok: true };
        },
        ping: async request => {
          console.log(
            "Received a ping event for %s",
            request.repository.full_name
          );

          const count = await requestQueue.getJobCounts();
          console.log("COUNT", count);
          return { ok: true, count };
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
