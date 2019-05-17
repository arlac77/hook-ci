import test from "ava";

import { streamIntoJob } from "../src/util.mjs";

async function* chunksStream(chunks) {
  for (const chunk of chunks) {
    yield chunk;
  }
}

test("log stream test", async t => {
  const lines = [];

  await streamIntoJob(
    chunksStream([
      Buffer.from("line "),
      Buffer.from("1\nline 2\nline 3\nline 4"),
      Buffer.from("\n")
    ]),
    { log: line => lines.push(line) }
  );

  t.deepEqual(lines, ["line 1", "line 2", "line 3", "line 4"]);
});
