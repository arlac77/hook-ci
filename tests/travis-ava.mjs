import test from "ava";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { travisAnalyse } from "../src/travis.mjs";
import { MockProvider } from "mock-repository-provider";
import { makeJob } from "./helpers/util.mjs";

const here = dirname(fileURLToPath(import.meta.url));

test("travis", async t => {
  const repositories = new MockProvider(join(here, "fixtures", "scenario1"), {
    repositoryName: "fixtures/scenario1"
  });

  const job = makeJob(1);

  const steps = await travisAnalyse(
    await repositories.branch("fixtures/scenario1#master"),
    job,
    {}, // defaultAnalyserConfig,
    "/tmp"
  );

  t.deepEqual(steps, []);
});
