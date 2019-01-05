import {} from "systemd";
import execa from "execa";
const Queue = require('bull');

//import micro from "micro";
const notify = require("sd-notify");
const micro = require("micro");
const createHandler = require("github-webhook-handler");

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
  console.log(
    "Received a push event for %s to %s",
    event.payload.repository.full_name,
    event.payload.ref
  );

  try {
    startJob(event.payload.repository.url);
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


const requestQueue = new Queue('pust-requests', 'redis://127.0.0.1:6379');

async function startJob(url)
{
  requestQueue.add({url });


  const wd = "/tmp/00000001";

  await execa("git", [ "clone" , url, wd]);
  await execa("npm", [ "install" ], { cwd: wd });
  await execa("npm", [ "test" ], { cwd: wd });
  await execa("npm", [ "run", "package" ], { cwd: wd });
}
