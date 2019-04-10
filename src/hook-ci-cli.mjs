import {} from "systemd";
import execa from "execa";
import { join, dirname, resolve } from "path";
import Queue from "bull";
import micro from "micro";
import globby from "globby";
import { version, description } from "../package.json";
import { utf8Encoding } from "./util";
import { runNpm } from "./npm";
import { pkgbuild } from "./pkgbuild";
import { createHookHandler } from "./hook-handler";
import program from "commander";
import { expand } from "config-expander";

program
  .version(version)
  .description(description)
  .option("-c, --config <dir>", "use config directory")
  .action(async () => {
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
          port: "${first(env.PORT,8093)}"
        }
      }
    });

    console.log(config);

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

    const handler = createHookHandler(requestQueue);

    const server = micro(async (req, res) => {
      handler(req, res, err => {
        if (err) {
          console.log(err);
          res.writeHead(404);
          res.end("no such location");
        } else {
          res.writeHead(200);
          res.end("woot");
        }
      });
    });

    server.on( 'listening', (...args) => console.log(...args));

    server.listen(config.http.port);

    async function startJob(job) {
      const url = job.data.repository.url;
      console.log("start: ", url);
      const wd = join(config.workspace.dir, job.data.head_commit.id);

      job.progress(1);

      const proc = execa("git", ["clone", "--depth", config.git.clone.depth, url, wd]);
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
  })
  .parse(process.argv);
