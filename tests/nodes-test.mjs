import test from "ava";
import { detectCapabilities, detectCapabilitiesFrom, CapabilitiyDetectors } from "../src/service-nodes.mjs";

test("initialize nodes", async t => {
  const bus = {
   config: {
     nodename: 'local'
   }
  };

 // await initializeNodes(bus);

  t.is(bus.nodes[0].name, 'local');
});


function detect(executable, stdout) {
  const d = detectCapabilitiesFrom(CapabilitiyDetectors.find(c => c.executable === executable), stdout);
  if (d) {
    delete d.executable;
  }
  return d;
}

test("detectors", t => {
  t.deepEqual(detect('makepkg',
    "makepkg (pacman) 5.1.3\nCopyright (c) 2006-2018 Pacman Development Team <pacman-dev@archlinux.org>.\nCopyright (C) 2002-2006 Judd Vinet <jvinet@zeroflux.org>.\n\nThis is free software; see the source for copying conditions.\nThere is NO WARRANTY, to the extent permitted by law."),
    { version: "5.1.3" });

  t.deepEqual(detect('uname',
    "Darwin pro.mf.de 18.6.0 Darwin Kernel Version 18.6.0: Tue May  7 22:54:55 PDT 2019; root:xnu-4903.270.19.100.1~2/RELEASE_X86_64 x86_64"), { os: 'Darwin', version: "18.6.0" });

  t.deepEqual(detect('uname',
    "Linux pine1 5.1.5-1-ARCH #1 SMP Sat May 25 13:23:49 MDT 2019 aarch64 GNU/Linux"), { os: 'Linux', version: "5.1.5-1-ARCH" });

  t.deepEqual(detect('git',
    "git version 2.21.0"),
    { version: "2.21.0" });

});


test("detect capabilities", async t => {
  const caps = await detectCapabilities();

  //console.log(caps);
  t.true(caps.length > 1);
});