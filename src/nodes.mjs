import execa from "execa";

export const defaultNodesConfig = {
    nodes: {
    }
};


export async function createNodes(config) {
    return [new LocalNode(config.nodename, { config })];
}


export class Node {
    constructor(name, options) {
        Object.defineProperties(this, {
            name: { value: name }, version: { value: options.version },
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