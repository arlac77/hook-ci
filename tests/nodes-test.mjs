import test from "ava";
import { createNodes,defaultNodesConfig } from "../src/nodes.mjs";

test("create nodes", async t => {
  const nodes = await createNodes({...defaultNodesConfig, nodename:'local'}
  );

  t.is(nodes[0].name, 'local');
});
