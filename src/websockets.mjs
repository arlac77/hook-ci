import WebSocket from "ws";
import bufferutil from "bufferutil";
import utf8Validate from "utf-8-validate";



export async function initializeWebsockets(bus) {
  const wss = new WebSocket.Server({ server: bus.server });

  wss.on("connection", ws => {
    ws.on("message", message => {
      console.log("received: %s", message);
    });

    ws.send("something");
  });

  bus.wss = wss;

  return wss;
}
