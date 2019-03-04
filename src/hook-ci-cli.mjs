import {} from "systemd";
import execa from "execa";
import { join, dirname } from "path";
import Queue from "bull";
import micro from "micro";
import globby from "globby";
import { utf8Encoding } from "./util";
import { runNpm } from "./npm";
import { createHookHandler } from "./hook-handler";

const dataDir = "/var/lib/hook-ci";
const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";

const requestQueue = new Queue("post-requests", REDIS_URL);
const cleanupQueue = new Queue("cleanup", REDIS_URL);
const errorQueue = new Queue("error", REDIS_URL);

requestQueue.on("cleaned", (job, type) => {
  console.log("Cleaned %s %s jobs", job.length, type);
});

cleanupQueue.process(async (job, done) => {
  requestQueue.clean(5000);
  //queue.clean(10000, 'failed');

  console.log("cleanup process", job);
  if (job.data.after) {
    const wd = join(dataDir, job.data.after);

    console.log(`rm -rf ${wd}`, job);

    const proc = await execa("rm", ["-rf", wd], { cwd: wd });
  }
  done();
});

errorQueue.process(async (job, done) => {
  console.log("error process", job);
  done();
});

requestQueue.process(async (job, done) => {
  console.log("post-requests process", job);
  try {
    done(null, await startJob(job));
    cleanupQueue.add(job);
  } catch (e) {
    done(e);
    errorQueue.add(job);
  }
});

requestQueue.on("completed", (job, result) => {
  console.log(`post-requests completed with result ${result}`);
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

  let proc;
  proc = execa("git", ["clone", "--depth", "50", url, wd]);
  proc.stdout.pipe(process.stdout);
  proc.stderr.pipe(process.stderr);
  await proc;

  for (const pkg of await globby(["**/package.json"], { cwd: wd })) {
    console.log("PACKAGE", pkg, dirname(pkg));
    await runNpm(job, wd, dirname(pkg));
  }
}
