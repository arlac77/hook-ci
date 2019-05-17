import test from "ava";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { pkgbuildAnalyse } from "../src/pkgbuild.mjs";

const here = dirname(fileURLToPath(import.meta.url));

test("pkgbuild", async t => {
  const steps = await pkgbuildAnalyse(
    {
      analyse: {
        skip: ["!test", "!tests"]
      }
    },
    join(here, "fixtures", "scenario1")
  );

  t.deepEqual(
    steps,
    [
      {
        name: "build",
        executable: "makepkg",
        args: [],
        options: {}
        progress: 100
      }
    ]
  );
});
