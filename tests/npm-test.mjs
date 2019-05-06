import test from "ava";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { npmAnalyse } from "../src/npm.mjs";

const here = dirname(fileURLToPath(import.meta.url));

test("npm", async t => {
  const steps = await npmAnalyse(join(here, "fixtures", "scenario1"));

  t.deepEqual(steps.map(s => { delete s.execute; return s; }), [
    {
      name: "prepare",
      directory: ".",
      executable: "npm",
      args: ["install"],
      progress: 10
    },
    {
      name: "test",
      directory: ".",
      executable: "npm",
      args: ["test"],
      progress: 30
    },
    {
      name: "deploy",
      directory: ".",
      executable: "npx",
      args: ["semantic-release"],
      progress: 100,
      options: {
        localDir: true
      }
    }
  ]);
});
