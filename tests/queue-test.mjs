import test from "ava";
import { queueDefinitions } from "../src/queues.mjs";

test("queue defs simple", t => {
  t.deepEqual(queueDefinitions({ a: { active: true } }), [
    { active: true, name: "a", type: "a" }
  ]);
});

test("queue defs combi", t => {
  t.deepEqual(
    queueDefinitions({
      a: { active: true },
      "process-{{platform}}-{{arch}}": {
        active: true,
        clean: 86400000,
        propagate: {
          failed: "investigate",
          completed: "cleanup"
        },
        combinations: [
          { arch: "aarch64", platform: "linux" },
          { arch: "armv7", platform: "linux" }
        ],
        type: "process"
      }
    }),

    [
      { active: true, name: "a", type: "a" },
      {
        active: true,
        active: true,
        clean: 86400000,
        propagate: {
          failed: "investigate",
          completed: "cleanup"
        },
        name: "process-linux-aarch64",
        platform: "linux",
        arch: "aarch64",
        type: "process"
      },
      {
        active: true,
        active: true,
        clean: 86400000,
        propagate: {
          failed: "investigate",
          completed: "cleanup"
        },
        name: "process-linux-armv7",
        platform: "linux",
        arch: "armv7",
        type: "process"
      }
    ]
  );
});
