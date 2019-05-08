import { join, dirname, resolve } from "path";
import fs from "fs";
import execa from "execa";
import Queue from "bull";
import globby from "globby";
import { version, description } from "../package.json";
import program from "commander";
import { expand, removeSensibleValues } from "config-expander";
import { npmAnalyse } from "./npm.mjs";
import { pkgbuildAnalyse } from "./pkgbuild.mjs";
import { createServer } from "./server.mjs";
import { utf8Encoding } from "./util.mjs";

program
  .version(version)
  .description(description)
  .option("-c, --config <dir>", "use config directory")
  .action(async () => {
    let sd = { notify: () => {}, listeners: () => [] };

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
        },
        analyse: {
          skip: ["!test", "!tests"]
        }
      }
    });

    const listeners = sd.listeners();
    if (listeners.length > 0) config.http.port = listeners[0];

    console.log(removeSensibleValues(config));
    try {
      const queues = ["request", "cleanup", "error"].reduce((queues, name) => {
        queues[name] = new Queue(name, config.redis.url);
        return queues;
      }, {});

      queues.request.on("cleaned", (job, type) => {
        console.log("request queue cleaned %s %s jobs", job.length, type);
      });

      queues.cleanup.process(async job => {
        queues.request.clean(5000);
        queue.cleanup.clean(5000);

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
          queues.error.add(Object.assign({ error: e }, job.data));
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
          return {
            url
          };
        }

        const commit = job.data.head_commit.id;

        const wd = join(config.workspace.dir, commit);

        try {
          await fs.promises.access(wd, fs.constants.W_OK);
          console.log(`${wd} already present`);
        } catch (err) {
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
        }

        job.progress(10);

        const steps = (await Promise.all([
          npmAnalyse(config, wd),
          pkgbuildAnalyse(config, wd)
        ])).reduce((a, c) => {
          a.push(...c);
          return a;
        }, []);

        for (const step of steps) {
          try {
            console.log(`start ${step.name}`);
            const process = await step.execute(job, wd);
            console.log(`end ${step.name} ${process.code}`);
          } catch (e) {
            console.log(`failed ${step.name}`);
            console.log(e);
          }
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
