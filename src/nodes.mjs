import execa from "execa";
import nbonjour from "nbonjour";


export const defaultNodesConfig = {
    nodes: {
        mdns: {
        }
    }
};


export async function createNodes(config) {

    const nodes = [new LocalNode(config.nodename, { config })];

    if (config.nodes.mdns) {
        const bonjour = nbonjour.create();

        const type = 'hook-ci';

        bonjour.publish({ name: config.nodename, type, port: 3000 });

        const browser = bonjour.find({ type }, service => {
            console.log("FIND", service);

            if (!nodes.find(node => node.name === service.name)) {
                nodes.push(new Node(service.name));
            }
        });

        browser.start();
    }

    return nodes;
}


export class Node {
    constructor(name, options) {
        Object.defineProperties(this, {
            name: { value: name },
            capabilities: { value: {} }
        });
    }

    async state() {
        return {
            name: this.name,
            versions: {},
            memory: {},
            capabilities: {}
        };
    }
}

/**
 * the node we are ourselfs
 */
export class LocalNode extends Node {

    constructor(name, options) {
        super(name, options);
        Object.defineProperties(this, { config: { value: options.config } });
    }

    async restart() {
        setTimeout(() => { process.exit(0); }, 500);
    }

    async state() {
        return {
            name: this.name,
            version: this.config.version,
            versions: process.versions,
            platform: process.platform,
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            capabilities: await detectCapabilities()
        };
    }
}

async function detectCapabilities() {
    return (await Promise.all(CapabilitiyDetectors.map(async step => {
        try {
            const proc = await execa(step.executable, step.args);
            let version = proc.stdout;

            if (step.regex) {
                const m = proc.stdout.match(step.regex);
                if (m) {
                    version = m.groups.version;
                }
            }

            return { executable: step.executable, version };
        }
        catch (error) {
        }

        return undefined;
    }))).filter(x => x !== undefined);
}

export const CapabilitiyDetectors = [
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
        args: ["-a"]
        // Darwin pro.mf.de 18.6.0 Darwin Kernel Version 18.6.0: Tue May  7 22:54:55 PDT 2019; root:xnu-4903.270.19.100.1~2/RELEASE_X86_64 x86_64
        // Linux pine1 5.1.5-1-ARCH #1 SMP Sat May 25 13:23:49 MDT 2019 aarch64 GNU/Linux
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
    }, {
        executable: "makepkg",
        args: ["--version"],
        // makepkg (pacman) 5.1.3\nCopyright (c) 2006-2018 Pacman Development Team <pacman-dev@archlinux.org>.\nCopyright (C) 2002-2006 Judd Vinet <jvinet@zeroflux.org>.\n\nThis is free software; see the source for copying conditions.\nThere is NO WARRANTY, to the extent permitted by law.
        regex: /makepkg\s+\(\w+\)\s+(?<version>[\d\.]+)/
    }, {
        executable: "java",
        args: ["--version"]
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
    }
];