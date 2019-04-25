import execa from "execa";
import { join, dirname, resolve } from "path";
import Queue from "bull";
import globby from "globby";
import { version, description } from "../package.json";
import program from "commander";
import { expand } from "config-expander";
import { runNpm } from "./npm.mjs";
import { pkgbuild } from "./pkgbuild.mjs";
import { createServer } from "./server.mjs";
import { utf8Encoding } from "./util.mjs";

program
  .version(version)
  .description(description)
  .option("-c, --config <dir>", "use config directory")
  .action(async () => {
    let sd = { notify: (...args) => console.log(...args), listeners: () => [] };
    try {
      sd = await import("sd-daemon");
    } catch (e) {}
    sd.notify("READY=1\nSTATUS=starting");

    const configDir = process.env.CONFIGURATION_DIRECTORY || program.config;

    const config = await expand(configDir ? "${include('config.json')}" : {}, {
      constants: {
        basedir: configDir || process.cwd(),
        installdir: resolve(__dirname, "..")
      },
      default: {
        git: {
          clone: {
            depth: 10
          }
        },
        workspace: { dir: "${first(env.STATE_DIRECTORY,'/tmp')}" },
        redis: { url: "${first(env.REDIS_URL,'redis://127.0.0.1:6379')}" },
        http: {
          port: "${first(env.PORT,8093)}",
          hook: {
            path: "/webhook",
            secret: "${env.WEBHOOK_SECRET}"
          }
        }
      }
    });

    const listeners = sd.listeners();
    if (listeners.length > 0) config.http.port = listeners[0];

    console.log(config);

    try {
      const requestQueue = new Queue("post-requests", config.redis.url);
      const cleanupQueue = new Queue("cleanup", config.redis.url);
      const errorQueue = new Queue("error", config.redis.url);

      requestQueue.on("cleaned", (job, type) => {
        console.log("requestQueue cleaned %s %s jobs", job.length, type);
      });

      cleanupQueue.process(async job => {
        requestQueue.clean(5000);
        //queue.clean(10000, 'failed');

        console.log("cleanupQueue", job.data.after);

        if (job.data.after) {
          const wd = join(config.workspace.dir, job.data.after);

          console.log(`rm -rf ${wd}`);

          const proc = await execa("rm", ["-rf", wd]);
        }
      });

      errorQueue.process(async job => {
        console.log("errorQueue", job.data.error);
      });

      requestQueue.process(async job => {
        try {
          const result = await startJob(job);
          cleanupQueue.add(job.data);
          return result;
        } catch (e) {
          errorQueue.add({ error: e });
          throw e;
        }
      });

      requestQueue.on("completed", (job, result) => {
        console.log("requestQueue completed", result);
      });

      const server = await createServer(config, sd, requestQueue);

      async function startJob(job) {
        const url = job.data.repository.url;
        console.log("start: ", url);
        const wd = join(config.workspace.dir, job.data.head_commit.id);

        job.progress(1);

        const proc = execa("git", [
          "clone",
          "--depth",
          config.git.clone.depth,
          url,
          wd
        ]);
        proc.stdout.pipe(process.stdout);
        proc.stderr.pipe(process.stderr);
        await proc;

        for (const pkg of await globby(["**/package.json"], { cwd: wd })) {
          console.log("PACKAGE.JSON", pkg, dirname(pkg));
          await runNpm(job, wd, dirname(pkg));
        }

        for (const pkg of await globby(["**/PKGBUILD"], { cwd: wd })) {
          console.log("PKGBUILD", pkg, dirname(pkg));
          await pkgbuild(job, wd, dirname(pkg));
        }

        return {
          url,
          wd,
          arch: process.arch
        };
      }
    } catch (e) {
      console.log(e);
    }
  })
  .parse(process.argv);
