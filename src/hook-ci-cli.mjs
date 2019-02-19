import {} from "systemd";
import execa from "execa";
import { join, dirname } from "path";
import { createWriteStream } from "fs";
import Queue from "bull";
import micro from "micro";
import createHandler from "github-webhook-handler";
import globby from "globby";

const dataDir = "/var/lib/hook-ci";

const requestQueue = new Queue("post-requests", "redis://127.0.0.1:6379");
const cleanupQueue = new Queue("cleanup", "redis://127.0.0.1:6379");
const errorQueue = new Queue("error", "redis://127.0.0.1:6379");

cleanupQueue.process(async (job, done) => {
  console.log("cleanup process", job);
  if(job.data.after) {
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

const handler = createHandler({
  path: "/webhook",
  secret: process.env.WEBHOOK_SECRET
});

handler.on("error", err => {
  console.error("Error:", err.message);
});

handler.on("ping", async event => {
  console.log(
    "Received a ping event for %s",
    event.payload.repository.full_name
  );

  const counts = await requestQueue.getJobCounts();
  console.log(counts);
});

handler.on("push", async event => {
  try {
    console.log(
      "Received a push event for %s to %s",
      event.payload.repository.full_name,
      event.payload.ref
    );

    requestQueue.add(event.payload);
  } catch (e) {
    console.error(e);
  }
});

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
  const utf8Encoding = { encoding: "utf8" };

  const url = job.data.repository.url;
  console.log("start: ", url);
  const wd = join(dataDir, job.data.head_commit.id);

  job.progress(1);

  let proc;
  proc = execa("git", ["clone", "--depth", "50", url, wd]);
  proc.stdout.pipe(process.stdout);
  proc.stderr.pipe(process.stderr);
  await proc;

  for (const pkg in await globby(["**/package.json"])) {
    console.log("PACKAGE", pkg, dirname(pkg));
    await runNpm(job, wd, dirname(pkg));
  }
}

async function runNpm(job, wd, dir) {
  const pkgDir = join(wd,dir);

  job.progress(10);

  proc = execa("npm", ["install"], { cwd: pkgDir });
  proc.stdout.pipe(
    createWriteStream(join(wd, "install.stdout.log"), utf8Encoding)
  );
  proc.stderr.pipe(
    createWriteStream(join(wd, "install.stderr.log"), utf8Encoding)
  );
  await proc;

  job.progress(30);

  proc = execa("npm", ["test"], { cwd: pkgDir });
  proc.stdout.pipe(
    createWriteStream(join(wd, "test.stdout.log"), utf8Encoding)
  );
  proc.stderr.pipe(
    createWriteStream(join(wd, "test.stderr.log"), utf8Encoding)
  );
  await proc;

  job.progress(80);

  proc = execa("npm", ["run", "package"], { cwd: pkgDir });
  proc.stdout.pipe(
    createWriteStream(join(wd, "package.stdout.log"), utf8Encoding)
  );
  proc.stderr.pipe(
    createWriteStream(join(wd, "package.stderr.log"), utf8Encoding)
  );
  await proc;

  job.progress(100);
}
