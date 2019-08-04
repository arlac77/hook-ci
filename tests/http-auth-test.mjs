import test from "ava";
import got from "got";
import { initializeServer } from "../src/server.mjs";
import { makeConfig, sd } from "./util.mjs";

let _port = 3149;

function nextPort() {
  return _port++;
}

test("authenticate positive", async t => {
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
  t.truthy(response.body.access_token.length > 10);

  const access_token = response.body.access_token;
  const data = JSON.parse(Buffer.from(access_token.split(".")[1], "base64"));
  t.deepEqual(data.entitlements.split(/,/), ["ci", "ci.nodes.read"]);

  bus.server.close();
});

test("authenticate wrong credentials", async t => {
  const port = nextPort();
  const bus = {
    config: makeConfig(port),
    sd
  };

  await initializeServer(bus);

  try {
    const response = await got.post(`http://localhost:${port}/authenticate`, {
      body: {
        username: "user1",
        password: "wrong"
      },
      json: true
    });

    t.fail("should throw 401");
  } catch (error) {
    t.is(error.statusCode, 401);
    t.is(error.body, "Authentication failed");
  }

  bus.server.close();
});

test("authenticate no entitlements", async t => {
  const port = nextPort();
  const bus = {
    config: makeConfig(port),
    sd
  };

  await initializeServer(bus);

  try {
    const response = await got.post(`http://localhost:${port}/authenticate`, {
      body: {
        username: "user2",
        password: "secret"
      },
      json: true
    });

    t.log(response.body);
    t.fail("should throw 403");

    const access_token = response.body.access_token;
    const data = JSON.parse(Buffer.from(access_token.split(".")[1], "base64"));
    t.log(data);
  } catch (error) {
    t.is(error.statusCode, 403);
    t.is(error.body, "Not authorized");
  }

  bus.server.close();
});
