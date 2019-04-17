import { createServer as httpCreateServer } from "http";
import { createServer as httpsCreateServer } from "https";
import Koa from "koa";
import rawBody from "raw-body";
import Router from "koa-better-router";
import { createHmac } from "crypto";

export async function createServer(config, sd, requestQueue) {
  const app = new Koa();

  const server = config.http.cert
    ? httpsCreateServer(config.http, app.callback())
    : httpCreateServer(app.callback());
  server.on("error", err => console.log(err));
  const router = Router();

  router.addRoute("GET", "/state", async (ctx, next) => {
    ctx.body = {
      version: config.version
    };
    return next();
  });

  router.addRoute("POST", config.http.hook.path, async (ctx, next) => {
    const [sig, event, id] = headers(ctx, [
      "x-hub-signature",
      "x-github-event",
      "x-github-delivery"
    ]);

    const body = await rawBody(ctx.req);
    const data = JSON.parse(body.toString());

    if (!verify(sig, body, config.http.hook.secret)) {
      ctx.throw('X-Hub-Signature does not match blob signature')
    }

    requestQueue.add(data);

    ctx.body = { ok: true };
    return next();
  });

  app.use(router.middleware());

  const listener = app.listen(config.http.port, () => {
    console.log("listen on", listener.address());
    sd.notify("READY=1\nSTATUS=running");
  });

  return server;
}

function headers(ctx, names) {
  return names.map(name => {
    const v = ctx.get(name);
    if (v === undefined) {
      ctx.throw(400, `${name} required`);
    }
    return v;
  });
}

function sign(data, secret) {
  return (
    "sha1=" +
    createHmac("sha1", secret)
      .update(data)
      .digest("hex")
  );
}

function verify(signature, data, secret) {
  return Buffer.from(signature).equals(Buffer.from(sign(data, secret)));
}
