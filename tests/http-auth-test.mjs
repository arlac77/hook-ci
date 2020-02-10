import test from "ava";
import got from "got";
import { initializeServer } from "../src/server.mjs";
import { makeConfig, sd } from "./helpers/util.mjs";

let port = 3159;

test("authenticate positive", async t => {
  port++;
  const bus = {
    config: makeConfig(port),
    queues: {},
    sd
  };

  await initializeServer(bus);

  const response = await got.post(`http://localhost:${port}/authenticate`, {
    json: {
      username: "user1",
      password: "secret"
    }
  });

  t.is(response.statusCode, 200);
  const access_token = JSON.parse(response.body).access_token;

  t.truthy(access_token.length > 10);

  const data = JSON.parse(Buffer.from(access_token.split(".")[1], "base64"));
  t.deepEqual(data.entitlements.split(/,/), ["ci", "ci.nodes.read"]);

  bus.server.close();
});

test("authenticate wrong credentials", async t => {
  port++;
  const bus = {
    config: makeConfig(port),
    queues: {},
    sd
  };

  await initializeServer(bus);

  try {
    const response = await got.post(`http://localhost:${port}/authenticate`, {
      json: {
        username: "user1",
        password: "wrong"
      }
    });

    t.fail("should throw 401");
  } catch (error) {
    //console.log(error.response);
    t.is(error.response.statusCode, 401);
  //  t.is(error.response.statusMessage, "Authentication failed");

  //  t.is(error.body, "Authentication failed");
  }

  bus.server.close();
});

test("authenticate no entitlements", async t => {
  port++;
  const bus = {
    config: makeConfig(port),
    queues: {},
    sd
  };

  await initializeServer(bus);

  try {
    const response = await got.post(`http://localhost:${port}/authenticate`, {
      json: {
        username: "user2",
        password: "secret"
      }
    });

    t.log(response.body);
    t.fail("should throw 403");

    const access_token = JSON.parse(response.body).access_token;
    const data = JSON.parse(Buffer.from(access_token.split(".")[1], "base64"));
    t.log(data);
  } catch (error) {
    t.is(error.response.statusCode, 403);
   // t.is(error.response.statusMessage, "Not authorized");
  }

  bus.server.close();
});
