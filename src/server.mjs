import { createServer as httpCreateServer } from "http";
import { createServer as httpsCreateServer } from "https";
import Koa from "koa";
import Router from "koa-better-router";
import BodyParser from "koa-bodyparser";
import { createHooks } from "./hooks.mjs";
import { initGraphQL } from "./graphql.mjs";

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

function getNode(nodes, name, ctx) {
  const node = nodes.find(name => {
    return (
      (name === "local" && config.nodename === node.name) || node.name === name
    );
  });
  if (!node) {
    ctx.throw(500, `Node ${name} not found`);
  }

  return node;
}

export async function initializeServer(bus) {
  const config = bus.config;

  const app = new Koa();

  bus.app = app;

  const server = config.http.cert
    ? httpsCreateServer(config.http, app.callback())
    : httpCreateServer(app.callback());

  bus.server = server;

  server.on("error", err => console.log(err));

  const router = Router({
    notFound: async (ctx, next) => {
      console.log("route not found", ctx.request.url);
      return next();
    }
  });

  router.addRoute("GET", "/authorize", async (ctx, next) => {
    body = {
      ...config.oauth2
    };
    return next();
  });

  router.addRoute("GET", "/nodes/state", async (ctx, next) => {
    ctx.body = await Promise.all(bus.nodes.map(node => node.state()));
    return next();
  });

  router.addRoute("GET", "/node/:node/state", async (ctx, next) => {
    const node = getNode(bus.nodes, ctx.params.node, ctx);
    ctx.body = await node.state();
    return next();
  });

  router.addRoute("POST", "/node/:node/restart", async (ctx, next) => {
    const node = getNode(bus.nodes, ctx.params.node, ctx);
    await node.restart();
    ctx.body = {};
    return next();
  });

  router.addRoute("POST", "/node/:node/stop", async (ctx, next) => {
    const node = getNode(bus.nodes, ctx.params.node, ctx);
    await node.stop();
    ctx.body = {};
    return next();
  });

  router.addRoute("GET", "/repositories", async (ctx, next) => {
    const rs = [];

    for await (const repository of bus.repositories.repositories(
      ctx.query.pattern || "*"
    )) {
      rs.push(repository.toJSON());
    }

    ctx.body = rs;

    return next();
  });

  router.addRoute("GET", "/queues", async (ctx, next) => {
    ctx.body = await Promise.all(
      Object.keys(bus.queues).map(async name => {
        const queue = bus.queues[name];
        return queueDetails(name, queue);
      })
    );
    return next();
  });

  router.addRoute("GET", "/queue/:queue", async (ctx, next) => {
    ctx.body = await queueDetails(
      ctx.params.queue,
      getQueue(bus.queues, ctx.params.queue, ctx)
    );
    return next();
  });

  router.addRoute(
    "POST",
    "/queue/:queue/add",
    BodyParser(),
    async (ctx, next) => {
      const queue = getQueue(bus.queues, ctx.params.queue, ctx);

      await queue.add(ctx.request.body);
      ctx.body = {};
      return next();
    }
  );

  router.addRoute("POST", "/queue/:queue/pause", async (ctx, next) => {
    const queue = getQueue(bus.queues, ctx.params.queue, ctx);
    await queue.pause();
    ctx.body = {};
    return next();
  });

  router.addRoute("POST", "/queue/:queue/resume", async (ctx, next) => {
    const queue = getQueue(bus.queues, ctx.params.queue, ctx);
    await queue.resume();
    ctx.body = {};
    return next();
  });

  router.addRoute("POST", "/queue/:queue/empty", async (ctx, next) => {
    const queue = getQueue(bus.queues, ctx.params.queue, ctx);
    await queue.empty();
    ctx.body = {};
    return next();
  });

  router.addRoute("GET", "/queue/:queue/jobs", async (ctx, next) => {
    //ctx.query.states;
    const queue = getQueue(bus.queues, ctx.params.queue, ctx);
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
      const queue = getQueue(bus.queues, ctx.params.queue, ctx);
      //const job = await queue.getJob(ctx.params.job);
      ctx.throw(500, `Unable to cancel job ${ctx.params.job}`);

      return next();
    }
  );

  router.addRoute("GET", "/queue/:queue/job/:job", async (ctx, next) => {
    const queue = getQueue(bus.queues, ctx.params.queue, ctx);
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
    console.log(
      "GET LOG",
      ctx.params.queue,
      ctx.params.job,
      ctx.query.start,
      ctx.query.end
    );
    const queue = getQueue(bus.queues, ctx.params.queue, ctx);
    ctx.body = await queue.getJobLogs(
      ctx.params.job,
      ctx.query.start,
      ctx.query.end
    );
    return next();
  });

  bus.router = router;

  createHooks(config.http.hooks, router, bus.queues);

  initGraphQL(bus);

  app.use(router.middleware());

  const listener = server.listen(config.http.port, () => {
    console.log("listen on", listener.address());
    bus.sd.notify("READY=1\nSTATUS=running");
  });
}
