import test from "ava";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { defaultAnalyserConfig } from "../src/analyser.mjs";
import { pkgbuildAnalyse } from "../src/pkgbuild.mjs";
import { MockProvider } from "mock-repository-provider";
import { makeJob } from "./helpers/util.mjs";

const here = dirname(fileURLToPath(import.meta.url));

test("pkgbuild", async t => {
  const repositories = new MockProvider(join(here, "fixtures", "scenario1"), {
    repositoryName: "fixtures/scenario1"
  });

  const job = makeJob(1);

  const steps = await pkgbuildAnalyse(
    await repositories.branch("fixtures/scenario1#master"),
    job,
    defaultAnalyserConfig,
    "/tmp"
  );

  t.deepEqual(steps, [
    {
      timeout: 1800000,
      name: "build",
      executable: "makepkg",
      args: [],
      options: { cwd: "/tmp" },
      requirements: [
        {
          executable: "makepkg"
        },
        {
          architecture: "aarch64"
        }
      ]
    }
  ]);
});
