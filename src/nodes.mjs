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
            name: this.name
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
            return { executable: step.executable, version: proc.stdout };
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
        args: ["--version"]
    },
    {
        executable: "clang",
        args: ["--version"]
    }, {
        executable: "makepkg",
        args: ["--version"]
    }, {
        executable: "java",
        args: ["--version"]
    }
];