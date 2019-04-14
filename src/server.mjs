import micro from "micro";
import { createHookHandler } from "./hook-handler";


export async function createServer(config, sd, requestQueue)
{
  const handler = createHookHandler(config,requestQueue);

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

  const listener = server.listen(config.http.port, () => {
    console.log("listen on", listener.address());
    sd.notify("READY=1\nSTATUS=running");
  });

  return server;
}
