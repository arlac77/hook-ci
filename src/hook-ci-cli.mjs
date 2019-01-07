import {} from "systemd";
import execa from "execa";
import { join } from "path";

const Queue = require("bull");

//import micro from "micro";
const notify = require("sd-notify");
const micro = require("micro");
const createHandler = require("github-webhook-handler");

const dataDir = "/var/lib/hook-ci";

const requestQueue = new Queue("post-requests", "redis://127.0.0.1:6379");

requestQueue.process(async (job, data) => {
  console.log("post-requests process", job);
  startJob(job);
  return 77;
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

notify.sendStatus("starting up");

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

notify.ready();

async function startJob(request) {
  const url = request.repository.url;
  const wd = join(dataDir, request.head_commit.id);

  await execa("git", ["clone", url, wd]);
  await execa("npm", ["install"], { cwd: wd });
  await execa("npm", ["test"], { cwd: wd });
  await execa("npm", ["run", "package"], { cwd: wd });
}
