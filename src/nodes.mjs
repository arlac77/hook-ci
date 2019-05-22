export const defaultNodesConfig = {
    nodes: {
    }
};


export async function createNodes(config) {
    return [new LocalNode(node.name, { config })];
}


export class Node {
    constructor(name, options) {
        Object.defineProperties(this, { name: { value: name }, version: { value: options.version } });
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
            memory: process.memoryUsage()
        };
    }
}