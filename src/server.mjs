import Koa from "koa";
import KoaJWT from "koa-jwt";
import Router from "koa-better-router";
import BodyParser from "koa-bodyparser";
import { createHooks } from "./hooks.mjs";
import { initGraphQL } from "./graphql.mjs";
import { accessTokenGenerator } from "./auth.mjs";

export const defaultServerConfig = {
  http: {
    port: "${first(env.PORT,8094)}",
    hooks: {
      gitea: {
        path: "/gitea",
        secret: "${env.WEBHOOK_SECRET}",
        queue: "incoming"
      },
      bitbucket: {
        path: "/bitbucket",
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

function getQueue(queues, ctx) {
  const name = ctx.params.queue;
  const queue = queues[name];
  if (!queue) {
    ctx.throw(500, `Queue ${name} not found`);
  }

  return queue;
}

async function getJob(queues, ctx) {
  const queue = getQueue(queues, ctx);
  const job = await queue.getJob(ctx.params.job);

  if (!job) {
    ctx.throw(500, `Job ${ctx.params.job} not found`);
  }

  return job;
}

function getNode(nodes, name, ctx) {
  const node = nodes.find(
    node =>
      (name === "local" && config.nodename === node.name) || node.name === name
  );
  if (!node) {
    ctx.throw(500, `Node ${name} not found`);
  }

  return node;
}

function setNoCacheHeaders(ctx) {
  ctx.set("Cache-Control", "no-store, no-cache, must-revalidate");
  ctx.set("Pragma", "no-cache");
  ctx.set("Expires", 0);
}

export async function initializeServer(bus) {
  const config = bus.config;

  const app = new Koa();

  bus.app = app;

  const router = Router({
    notFound: async (ctx, next) => {
      console.log("route not found", ctx.request.url);
      return next();
    }
  });

  router.addRoute(
    "POST",
    "/authenticate",
    BodyParser(),
    accessTokenGenerator(config, e => e.startsWith("ci"))
  );

  // middleware to restrict access to token holding requests
  const restricted = KoaJWT({
    secret: config.auth.jwt.public
  });

  router.addRoute("GET", "/authorize", async (ctx, next) => {
    body = {
      ...config.auth.oauth2
    };
    return next();
  });

  router.addRoute("GET", "/nodes/state", restricted, async (ctx, next) => {
    setNoCacheHeaders(ctx);
    ctx.body = await Promise.all(bus.nodes.map(node => node.state()));
    return next();
  });

  router.addRoute("GET", "/node/:node/state", restricted, async (ctx, next) => {
    setNoCacheHeaders(ctx);
    const node = getNode(bus.nodes, ctx.params.node, ctx);
    ctx.body = await node.state();
    return next();
  });

  router.addRoute(
    "POST",
    "/node/:node/restart",
    restricted,
    async (ctx, next) => {
      const node = getNode(bus.nodes, ctx.params.node, ctx);
      await node.restart();
      ctx.body = {};
      return next();
    }
  );

  router.addRoute("POST", "/node/:node/stop", restricted, async (ctx, next) => {
    const node = getNode(bus.nodes, ctx.params.node, ctx);

    node.stop();

    ctx.body = {};
    return next();
  });

  router.addRoute(
    "POST",
    "/node/:node/reload",
    restricted,
    async (ctx, next) => {
      const node = getNode(bus.nodes, ctx.params.node, ctx);

      node.reload();

      ctx.body = {};
      return next();
    }
  );

  router.addRoute("GET", "/groups", restricted, async (ctx, next) => {
    setNoCacheHeaders(ctx);

    const rg = [];

    for await (const group of bus.repositories.repositoryGroups(
      ctx.query.pattern || "*"
    )) {
      rg.push(group.toJSON());
    }

    ctx.body = rg;

    return next();
  });

  router.addRoute("GET", "/repositories", restricted, async (ctx, next) => {
    setNoCacheHeaders(ctx);

    const rs = [];

    for await (const repository of bus.repositories.repositories(
      ctx.query.pattern || "*"
    )) {
      rs.push(repository.toJSON());
    }

    ctx.body = rs;

    return next();
  });

  router.addRoute("GET", "/queues", restricted, async (ctx, next) => {
    setNoCacheHeaders(ctx);

    ctx.body = await Promise.all(
      Object.keys(bus.queues).map(async name => {
        const queue = bus.queues[name];
        return queueDetails(name, queue);
      })
    );
    return next();
  });

  router.addRoute("GET", "/queue/:queue", restricted, async (ctx, next) => {
    setNoCacheHeaders(ctx);

    ctx.body = await queueDetails(
      ctx.params.queue,
      getQueue(bus.queues, ctx)
    );
    return next();
  });

  router.addRoute(
    "POST",
    "/queue/:queue/add",
    restricted,
    BodyParser(),
    async (ctx, next) => {
      const queue = getQueue(bus.queues, ctx);

      await queue.add(ctx.request.body);
      ctx.body = {};
      return next();
    }
  );

  router.addRoute(
    "POST",
    "/queue/:queue/pause",
    restricted,
    async (ctx, next) => {
      const queue = getQueue(bus.queues, ctx);
      await queue.pause();
      ctx.body = {};
      return next();
    }
  );

  router.addRoute(
    "POST",
    "/queue/:queue/resume",
    restricted,
    async (ctx, next) => {
      const queue = getQueue(bus.queues, ctx);
      await queue.resume();
      ctx.body = {};
      return next();
    }
  );

  router.addRoute(
    "POST",
    "/queue/:queue/empty",
    restricted,
    async (ctx, next) => {
      const queue = getQueue(bus.queues, ctx);
      await queue.clean(5000);
      await queue.empty();
      ctx.body = {};
      return next();
    }
  );

  router.addRoute(
    "GET",
    "/queue/:queue/jobs",
    restricted,
    async (ctx, next) => {
      setNoCacheHeaders(ctx);

      //ctx.query.states;
      const queue = getQueue(bus.queues, ctx);
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
    }
  );

  router.addRoute(
    "POST",
    "/queue/:queue/job/:job/cancel",
    restricted,
    async (ctx, next) => {
      const job = await getJob(bus.queues, ctx);
      await job.discard();

      ctx.body = {};

      //ctx.throw(500, `Unable to cancel job ${ctx.params.job}`);

      return next();
    }
  );

  router.addRoute(
    "POST",
    "/queue/:queue/job/:job/rerun",
    restricted,
    async (ctx, next) => {
      const job = await getJob(bus.queues, ctx);
      await job.retry();

      ctx.body = {};

      return next();
    }
  );

  router.addRoute(
    "GET",
    "/queue/:queue/job/:job",
    restricted,
    async (ctx, next) => {
      setNoCacheHeaders(ctx);

      const job = await getJob(bus.queues, ctx);
      ctx.body = {
        id: job.id,
        state: await job.getState(),
        attemptsMade: job.attemptsMade,
        processedOn: job.processedOn,
        finishedOn: job.processedOn,
        ...job.data
      };
      return next();
    }
  );

  router.addRoute(
    "GET",
    "/queue/:queue/job/:job/log",
    restricted,
    async (ctx, next) => {
      const queue = getQueue(bus.queues, ctx);
      ctx.body = await queue.getJobLogs(
        ctx.params.job,
        ctx.query.start,
        ctx.query.end
      );
      return next();
    }
  );

  bus.router = router;

  createHooks(config.http.hooks, router, bus.queues);

  initGraphQL(bus);

  app.use(router.middleware());

  bus.server = app.listen(config.http.port, () => {
    console.log("listen on", bus.server.address());
    bus.sd.notify("READY=1\nSTATUS=running");
  });
}
