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
        version,
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
      queues = ["requests", "cleanup", "error"].reduce((queues, name) => {
        queues[name] = new Queue(name, config.redis.url);
        return queues;
      }, {});

      queues.request.on("cleaned", (job, type) => {
        console.log("request queue cleaned %s %s jobs", job.length, type);
      });

      queues.cleanup.process(async job => {
        queues.request.clean(5000);
        //queue.clean(10000, 'failed');

        console.log("cleanup queue", job.data.after);

        if (job.data.after) {
          const wd = join(config.workspace.dir, job.data.after);

          console.log(`rm -rf ${wd}`);

          const proc = await execa("rm", ["-rf", wd]);
        }
      });

      queues.error.process(async job => {
        console.log("error queue", job.data.error);
      });

      queues.request.process(async job => {
        try {
          const result = await startJob(job);
          queues.cleanup.add(job.data);
          return result;
        } catch (e) {
          console.log(e);
          queues.error.add({ error: e });
          throw e;
        }
      });

      queues.request.on("completed", (job, result) => {
        console.log("request queue completed", result);
      });

      const server = await createServer(config, sd, queues);

      async function startJob(job) {
        const url = job.data.repository.url;
        console.log("start: ", url);

        if (!job.data.head_commit) {
          console.log("no commit id present");
          return;
        }

        const commit = job.data.head_commit.id;

        const wd = join(config.workspace.dir, commit);

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

        const steps = [];

        for (const pkg of await globby(["**/package.json"], { cwd: wd })) {
          console.log("PACKAGE.JSON", pkg, dirname(pkg));
          steps.push(runNpm(job, wd, dirname(pkg)));
        }

        for (const pkg of await globby(["**/PKGBUILD"], { cwd: wd })) {
          console.log("PKGBUILD", pkg, dirname(pkg));
          steps.push(await pkgbuild(job, wd, dirname(pkg)));
        }

        await Promise.all(steps);

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
