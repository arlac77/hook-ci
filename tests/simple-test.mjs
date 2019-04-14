import test from "ava";
import { createServer } from "../src/server";
import got from "got";
import signer from "x-hub-signature/src/signer";

test("request", async t => {
  let sd = { notify: (...args) => console.log(...args), listeners: () => [] };

  const port = "3152";
  const path = "webhook";
  const secret = "aSecret";

  const server = createServer({
    http: {
      port,
      hook: {
        path,
        secret
      }
    }
  }, sd, {

  });

  const sign = signer({ algorithm: "sha1", secret });
  const signature = sign(new Buffer("random-signature-body"));

  const response = await got.post(`http://localhost:${port}/${path}`, {
    headers: {
      "x-hub-signature": signature,
      "x-github-event": "push",
      "x-github-delivery": "77"
    }
  });

  console.log(response.body);

  t.is(response.statusCode, 200);
});
