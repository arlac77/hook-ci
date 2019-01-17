import test from "ava";
import {} from "../src/hook-ci-cli";

const got = require("got");
const { signer } = require("x-hub-signature");

test("request", async t => {
  const secret = "aSecret";

  process.env.WEBHOOK_SECRET = secret;
  process.env.PORT = "3100";

  const sign = signer({ algorithm: "sha1", secret });
  const signature = sign(new Buffer("random-signature-body"));

  const response = await got.post(
    `http://localhost:{process.env.PORT}/webhook`,
    {
      headers: {
        "x-hub-signature": signature,
        "x-github-event": "push",
        "x-github-delivery": "77"
      }
    }
  );

  console.log(response.body);

  t.is(response.statusCode, 200);
});
