import test from "ava";
import { executeStep } from "../src/processor.mjs";

test("executeStep", async t => {
  const proc = await executeStep(
    {
      name: "echo",
      directory: ".",
      executable: "npm",
      args: ["--version"]
    },
    { id: "1" },
    "/tmp"
  );

  t.is(proc.code, 0);
  t.regex(proc.stdout, /\d+\.\d+\.\d+/);
});
