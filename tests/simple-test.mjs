import test from "ava";
import {} from "../src/hook-ci-cli";
import got from "got";
import signer from "x-hub-signature/src/signer";

test("request", async t => {
  const secret = "aSecret";
  const port = "3152";
  process.env.WEBHOOK_SECRET = secret;
  process.env.PORT = port;
  const sign = signer({ algorithm: "sha1", secret });
  const signature = sign(new Buffer("random-signature-body"));

  const response = await got.post(`http://localhost${port}/webhook`, {
    headers: {
      "x-hub-signature": signature,
      "x-github-event": "push",
      "x-github-delivery": "77"
    }
  });

  console.log(response.body);

  t.is(response.statusCode, 200);
});
