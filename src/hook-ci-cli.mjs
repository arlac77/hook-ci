import {} from "systemd";
import execa from "execa";
import { join, dirname } from "path";
import Queue from "bull";
import micro from "micro";
import globby from "globby";
import { version, description } from "../package.json";
import { utf8Encoding } from "./util";
import { runNpm } from "./npm";
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
        workspace: { dir: "${first(env.STATE_DIRECTORY,'/tmp')}" },
        redis: { url: "${first(env.REDIS_URL,'redis://127.0.0.1:6379')}" }
      }
    });

    console.log(config);
  })
  .parse(process.argv);

const dataDir = "/var/lib/hook-ci";
const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";

const requestQueue = new Queue("post-requests", REDIS_URL);
const cleanupQueue = new Queue("cleanup", REDIS_URL);
const errorQueue = new Queue("error", REDIS_URL);

requestQueue.on("cleaned", (job, type) => {
  console.log("requestQueue cleaned %s %s jobs", job.length, type);
});

cleanupQueue.process(async job => {
  requestQueue.clean(5000);
  //queue.clean(10000, 'failed');

  console.log("cleanupQueue", job.data.after);

  if (job.data.after) {
    const wd = join(dataDir, job.data.after);

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

let port = "systemd";

if (process.env.PORT !== undefined) {
  port = parseInt(process.env.PORT, 10);
  if (Number.isNaN(port)) {
    port = process.env.PORT;
  }
}

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

server.listen(port);

async function startJob(job) {
  const url = job.data.repository.url;
  console.log("start: ", url);
  const wd = join(dataDir, job.data.head_commit.id);

  job.progress(1);

  const proc = execa("git", ["clone", "--depth", "10", url, wd]);
  proc.stdout.pipe(process.stdout);
  proc.stderr.pipe(process.stderr);
  await proc;

  for (const pkg of await globby(["**/package.json"], { cwd: wd })) {
    console.log("PACKAGE.JSON", pkg, dirname(pkg));
    await runNpm(job, wd, dirname(pkg));
  }

  return {
    url,
    wd,
    arch: process.arch
  };
}
