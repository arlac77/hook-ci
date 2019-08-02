import test from "ava";
import got from "got";
import { initializeServer } from "../src/server.mjs";
import { makeConfig, sd } from "./util.mjs";

let _port = 3149;

function nextPort() {
  return _port++;
}

test("server can authenticate", async t => {
  const port = nextPort();
  const bus = {
    config: makeConfig(port),
    sd
  };

  await initializeServer(bus);

  const response = await got.post(`http://localhost:${port}/authenticate`, {
    body: {
      username: "user1",
      password: "secret"
    },
    json: true
  });

  t.is(response.statusCode, 200);
  t.truthy(response.body.token.length > 10);

  const token = response.body.token;
  const data = JSON.parse(Buffer.from(token.split(".")[1], 'base64'));
  t.deepEqual(data.entitlements.split(/,/),["ci","ci.nodes.read"]);

  bus.server.close();
});
