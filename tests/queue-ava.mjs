import test from "ava";
import { queueDefinitions } from "../src/queues.mjs";

test("queue defs simple", t => {
  t.deepEqual(queueDefinitions({ a: { active: true } }), [
    { name: "a", type: "a", active: true, propagate: {} }
  ]);
});

test("queue defs combi", t => {
  t.deepEqual(
    queueDefinitions({
      publish: {
        active: false,
        clean: 86400000
      },
      cleanup: {
        active: true,
        clean: 86400000
      },
      "process-{{platform}}-{{arch}}": {
        active: true,
        clean: 86400000,
        propagate: {
          failed: "investigate",
          completed: "cleanup"
        },
        combinations: [
          { arch: "arm64", platform: "linux" },
          { arch: "arm", platform: "linux" }
        ],
        type: "process"
      }
    }),
    [
      {
        name: "publish",
        type: "publish",
        propagate: {},
        active: false,
        clean: 86400000
      },
      {
        name: "cleanup",
        type: "cleanup",
        propagate: {},
        active: true,
        clean: 86400000
      },
      {
        name: "process-linux-arm64",
        type: "process",
        active: true,
        clean: 86400000,
        propagate: {
          failed: "investigate",
          completed: "cleanup"
        },
        platform: "linux",
        arch: "arm64"
      },
      {
        name: "process-linux-arm",
        type: "process",
        active: true,
        clean: 86400000,
        propagate: {
          failed: "investigate",
          completed: "cleanup"
        },
        platform: "linux",
        arch: "arm"
      }
    ]
  );
});
