import test from "ava";
import { initializeServer } from "../src/server.mjs";
import { initializeWebsockets } from "../src/websockets.mjs";
import WebSocket from "ws";

const sd = { notify: () => {}, listeners: () => [] };

let _port = 3200;

function nextPort() {
  return _port++;
}

const queues = {
  incoming: {
    async getJobLogs() {},
    async add() {},
    async getJobs() {}
  }
};

test.cb("websocket", t => {
  t.plan(1);

  async function setupServer() {
    const port = nextPort();
    const bus = {
      config: 
        {
          version: 99,
          http: {
            port
          }
        },
        sd,
        queues
    };

    await initializeServer(bus);
    await initializeWebsockets(bus);

    const ws = new WebSocket(`ws://localhost:${port}/`, {
      rejectUnauthorized: false
    });

    //console.log("WS", ws);

    ws.on("open", () => {
      console.log("OPEN");
      ws.send("All glory to WebSockets!");

      ws.on('message', data => {
        console.log("MESSAGE", data);
      });

      t.pass();
      bus.server.close();
      t.end();
    });
  }

  setupServer();
});
