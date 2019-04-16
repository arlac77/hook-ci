import { createServer as httpCreateServer } from "http";
import { createServer as httpsCreateServer } from "https";
import Koa from "koa";
import bodyParser from "koa-bodyparser";
import Router from "koa-better-router";
import {createHmac} from 'crypto';

export async function createServer(config, sd, requestQueue) {
  const app = new Koa();

  app.use(bodyParser());

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

    console.log(ctx.request.body);

    /*
    if (!verify(sig, data)) {
      ctx.throw('X-Hub-Signature does not match blob signature')
    }
    */

    //obj = JSON.parse(data.toString())

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
    const v = ctx.headers[name];
    if (v === undefined) {
      ctx.throw(400, `${name} required`);
    }
    return v;
  });
}

function sign (data, secret) {
  return 'sha1=' + createHmac('sha1', secret).update(data).digest('hex');
}

function verify (signature, data) {
  return Buffer.from(signature).equals(Buffer.from(sign(data)));
}
