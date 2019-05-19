import test from "ava";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { defaultAnalyserConfig } from "../src/analyser.mjs";
import { pkgbuildAnalyse } from "../src/pkgbuild.mjs";

const here = dirname(fileURLToPath(import.meta.url));

test.skip("pkgbuild", async t => {


  const steps = await pkgbuildAnalyse(repositories,
    defaultAnalyserConfig,
    join(here, "fixtures", "scenario1")
  );

  t.deepEqual(steps, [
    {
      name: "build",
      executable: "makepkg",
      args: [],
      options: { cwd: join(here, "fixtures", "scenario1") }
    }
  ]);
});
