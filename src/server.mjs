import { createServer as httpCreateServer } from "http";
import { createServer as httpsCreateServer } from "https";
import Koa from "koa";
import bodyParser from "koa-bodyparser";
import Router from "koa-better-router";

export async function createServer(config, sd, requestQueue)
{
  const app = new Koa();

  app.use(bodyParser());

  const server = config.http.cert
    ? httpsCreateServer(config.http, app.callback())
    : httpCreateServer(app.callback());
  server.on("error", err => console.log(err));
  const router = Router();

  router.addRoute(
    "GET",
    "/state",
    async (ctx, next) => {
      ctx.body = {
        version: config.version
      };
      return next();
    }
  );

  router.addRoute(
    "GET",
    "/webhook",
    async (ctx, next) => {
      //obj = JSON.parse(data.toString())
      ctx.body = {ok:true};
      return next();
    }
  );

  app.use(router.middleware());

  const listener = app.listen(config.http.port, () => {
    console.log("listen on", listener.address());
    sd.notify("READY=1\nSTATUS=running");
  });

  return server;
}
