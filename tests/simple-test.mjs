import test from "ava";
import { createServer } from "../src/server";
import got from "got";
import signer from "x-hub-signature/src/signer";
import { promisify } from 'util'; 

const sd = { notify: (...args) => console.log(...args), listeners: () => [] };


test("request status", async t => {
  const port = 3152;
  const path = "webhook";
  const secret = "aSecret";

  const server = createServer({
    version: 99,
    http: {
      port,
      hook: {
        path,
        secret
      }
    }
  }, sd);

  const response = await got.get(`http://localhost:${port}/state`);

  t.is(response.statusCode, 200);

  await (promisify(server.close))();
});

test("request", async t => {
  const port = "3152";
  const path = "webhook";
  const secret = "aSecret";

  let payload;

  const server = createServer({
    http: {
      port,
      hook: {
        path,
        secret
      }
    }
  }, sd, {
    add(event) {
      payload = event.payload;
    }
  });

  const sign = signer({ algorithm: "sha1", secret });
  const signature = sign(new Buffer("random-signature-body"));

  const response = await got.post(`http://localhost:${port}/${path}`, {
    headers: {
      "x-hub-signature": signature,
      "x-github-event": "push",
      "x-github-delivery": "77"
    },
    data: "xyz"
  });

  console.log(response.body);
  console.log(payload);

  t.is(response.statusCode, 200);
  await (promisify(server.close))();
});
