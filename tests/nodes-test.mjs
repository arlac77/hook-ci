import test from "ava";
import { createNodes, defaultNodesConfig, CapabilitiyDetectors } from "../src/nodes.mjs";

test("create nodes", async t => {
  const nodes = await createNodes({ ...defaultNodesConfig, nodename: 'local' }
  );

  t.is(nodes[0].name, 'local');
});


function detect(executable, stdout) {
  const m = stdout.match(CapabilitiyDetectors.find(c => c.executable === executable).regex);
  if (m) {
    return m.groups.version;
  }
  return undefined;
}

test("detectors", t => {
  t.is(detect('makepkg',
    "makepkg (pacman) 5.1.3\nCopyright (c) 2006-2018 Pacman Development Team <pacman-dev@archlinux.org>.\nCopyright (C) 2002-2006 Judd Vinet <jvinet@zeroflux.org>.\n\nThis is free software; see the source for copying conditions.\nThere is NO WARRANTY, to the extent permitted by law."), "5.1.3");

});
