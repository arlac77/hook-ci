import test from "ava";
import { executeStep } from "../src/processor.mjs";
import { makeJob } from './util.mjs';

test("executeStep", async t => {
  const proc = await executeStep(
    {
      name: "echo",
      directory: ".",
      executable: "npm",
      args: ["--version"]
    },
    makeJob(1),
    "/tmp"
  );

  t.is(proc.exitCode, 0);
  t.regex(proc.stdout, /\d+\.\d+\.\d+/);
});
