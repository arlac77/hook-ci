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

            if(!nodes.find(node => node.name === service.name)) {
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
    return (await Promise.all(detectors.map(async step => {
        try {
            const proc = await execa(step.executable, step.args);
            let version = proc.stdout;

            if(step.regex) {
                const m = proc.stdout.match(step.regex);
                if(m) {
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

const detectors = [
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
    },
    {
        executable: "gcc",
        args: ["--version"],
        // gcc (GCC) 8.2.1 20181127\nCopyright (C) 2018 Free Software Foundation, Inc.\nThis is free software; see the source for copying conditions.  There is NO\nwarranty; not even for MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE
        regex : /gcc\s+\(\w+\)\s+(?<version>\[\d\.]+)/
    },
    {
        executable: "clang",
        args: ["--version"]
    }, {
        executable: "makepkg",
        args: ["--version"],
        // makepkg (pacman) 5.1.3\nCopyright (c) 2006-2018 Pacman Development Team <pacman-dev@archlinux.org>.\nCopyright (C) 2002-2006 Judd Vinet <jvinet@zeroflux.org>.\n\nThis is free software; see the source for copying conditions.\nThere is NO WARRANTY, to the extent permitted by law.
        regex : /makepkg\s+\(\w+\)\s+(?<version>\[\d\.]+)/
    }, {
        executable: "java",
        args: ["--version"]
    }
];