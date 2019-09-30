import execa from "execa";
import nbonjour from "nbonjour";

export const defaultNodesConfig = {
  nodes: {
    mdns: {
      type: "hook-ci"
    }
  }
};

export async function initializeNodes(bus) {
  const config = bus.config;

  const nodes = [new LocalNode(config.nodename, bus)];

  if (config.nodes.mdns) {
    const bonjour = nbonjour.create();

    const type = config.nodes.mdns.type;

    bonjour.publish({
      name: config.nodename,
      type,
      port: 3000,
      url: `https://${config.nodename}/services/ci/api`
    });

    const browser = bonjour.find({ type }, service => {
      if (service.name !== undefined && !nodes.find(node => node.name === service.name)) {
        console.log(service);
        nodes.push(new Node(service.name));
      }
    });

    browser.start();
  }

  bus.nodes = nodes;
}

export class Node {
  constructor(name, options) {
    Object.defineProperties(this, {
      name: { value: name },
      capabilities: { value: {} }
    });
  }

  get isLocal() {
    return false;
  }

  get version() {
    return "unknown";
  }

  get uptime() {
    return -1;
  }

  async state() {
    return {
      name: this.name,
      versions: {},
      memory: {},
      capabilities: []
    };
  }
}

/**
 * the node we are ourselfs
 */
export class LocalNode extends Node {
  constructor(name, options) {
    super(name, options);
    Object.defineProperties(this, { bus: { value: options } });
  }

  async restart() {
    return this.stop();
  }

  async stop() {
    this.bus.sd.notify("STOPPING=1");  
    process.exit(0);
  }

  async reload() {
    this.bus.sd.notify("RELOADING=1");  
  }

  get isLocal() {
    return true;
  }

  get config() {
    return this.bus.config;
  }

  get version() {
    return this.config.version;
  }

  get uptime() {
    return process.uptime();
  }

  async state() {
    return {
      name: this.name,
      version: this.bus.config.version,
      versions: process.versions,
      platform: process.platform,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      capabilities: await detectCapabilities()
    };
  }
}

export async function detectCapabilities() {
  return (await Promise.all(
    CapabilitiyDetectors.map(async step => {
      try {
        const proc = await execa(step.executable, step.args);
        return detectCapabilitiesFrom(step, proc.stdout);
      } catch (error) {
        //console.log(error);
      }

      return undefined;
    })
  )).filter(x => x !== undefined);
}

export function detectCapabilitiesFrom(step, stdout) {
  const m = stdout.match(step.regex);
  if (m) {
    return { executable: step.executable, ...m.groups };
  }

  return { executable: step.executable, version: stdout };
}

export const CapabilitiyDetectors = [
  {
    executable: "git",
    args: ["--version"],
    // git version 2.21.0
    regex: /git\s+\w+\s+(?<version>[\d\.]+)/
  },
  {
    executable: "node",
    args: ["--version"]
  },
  {
    executable: "npm",
    args: ["--version"]
  },
  {
    executable: "uname",
    args: ["-a"],
    // Darwin pro.mf.de 18.6.0 Darwin Kernel Version 18.6.0: Tue May  7 22:54:55 PDT 2019; root:xnu-4903.270.19.100.1~2/RELEASE_X86_64 x86_64
    // Linux pine1 5.1.5-1-ARCH #1 SMP Sat May 25 13:23:49 MDT 2019 aarch64 GNU/Linux
    regex: /^(?<os>\w+)\s+[\w\.]+\s+(?<version>[\d\.]+[\-\w]*)/
  },
  {
    executable: "gcc",
    args: ["--version"],
    // gcc (GCC) 8.2.1 20181127\nCopyright (C) 2018 Free Software Foundation, Inc.\nThis is free software; see the source for copying conditions.  There is NO\nwarranty; not even for MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE
    regex: /gcc\s+\(\w+\)\s+(?<version>[\d\.]+)/
  },
  {
    executable: "clang",
    args: ["--version"]
  },
  {
    executable: "makepkg",
    args: ["--version"],
    // makepkg (pacman) 5.1.3\nCopyright (c) 2006-2018 Pacman Development Team <pacman-dev@archlinux.org>.\nCopyright (C) 2002-2006 Judd Vinet <jvinet@zeroflux.org>.\n\nThis is free software; see the source for copying conditions.\nThere is NO WARRANTY, to the extent permitted by law.
    regex: /makepkg\s+\(\w+\)\s+(?<version>[\d\.]+)/
  },
  {
    executable: "java",
    args: ["-version"],

    /*
        openjdk version "11.0.3" 2019-04-16
        OpenJDK Runtime Environment (build 11.0.3+4)
        OpenJDK Server VM (build 11.0.3+4, mixed mode)

        java version "1.8.0_201"
        Java(TM) SE Runtime Environment (build 1.8.0_201-b09)
        Java HotSpot(TM) 64-Bit Server VM (build 25.201-b09, mixed mode)
        */
    regex: /(?<product>\w+)\s+version\s+"(?<version>[^\"]+)"/
  },
  {
    executable: "make",
    args: ["--version"],
    // GNU Make 3.81
    regex: /\w+\s+\w+\s+(?<version>[\d\.]+)/
  },
  {
    executable: "cmake",
    args: ["--version"],
    // cmake version 3.14.4
    regex: /\w+\s+\w+\s+(?<version>[\d\.]+)/
  },
  {
    executable: "rustc",
    args: ["--version"],
    // rustc 1.35.0
    regex: /\w+\s+(?<version>[\d\.]+)/
  },
  {
    executable: "go",
    args: ["version"],
    // go version go1.12.5 darwin/amd64
    regex: /go\s+version\s+(?<version>[go\d\.]+)/
  },
  {
    executable: "gradle",
    args: ["--version"],
    // Welcome to Gradle 5.4.1!
    regex: /to\s+Gradle\s+(?<version>[\d\.]+)/
  },
  {
    executable: "saxon",
    args: ["-?"],
    // Saxon-HE 9.9.0.1J from Saxonica
    regex: /Saxon(-\w+)?\s+(?<version>[\d\.\w]+)/
  },
  {
    executable: "rsync",
    args: ["--version"],
    // rsync  version 2.6.9  protocol version 29
    regex: /rsync(-\w+)?\s+(?<version>[\d\.]+)\s+protocol\s+version\s+(?<protocol>[\d\.]+)/
  }
];
