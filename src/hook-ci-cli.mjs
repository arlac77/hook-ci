import { resolve } from "path";
import { version, description } from "../package.json";
import program from "commander";
import { expand } from "config-expander";
import { removeSensibleValues } from "remove-sensible-values";
import { defaultServerConfig, createServer } from "./server.mjs";
import { defaultQueuesConfig, createQueues } from "./queues.mjs";
import { defaultAnalyserConfig } from "./analyser.mjs";
import { defaultProcessorConfig } from "./processor.mjs";
import { defaultAuthConfig } from "./auth.mjs";
import { defaultRepositoriesConfig, createRepositories } from "./repositories.mjs";
import { defaultNodesConfig, createNodes } from "./nodes.mjs";

program
  .version(version)
  .description(description)
  .option("-c, --config <dir>", "use config directory")
  .action(async () => {
    let sd = { notify: () => {}, listeners: () => [] };

    try {
      sd = require("sd-daemon");
      //sd = await import("sd-daemon");
    } catch (e) {}

    sd.notify("READY=1\nSTATUS=starting");

    const configDir = process.env.CONFIGURATION_DIRECTORY || program.config;

    const config = await expand(configDir ? "${include('config.json')}" : {}, {
      constants: {
        basedir: configDir || process.cwd(),
        installdir: resolve(__dirname, "..")
      },
      default: {
        version,
        nodename: "${os.hostname}",
        ...defaultNodesConfig,
        ...defaultAuthConfig,
        ...defaultRepositoriesConfig,
        ...defaultServerConfig,
        ...defaultProcessorConfig,
        ...defaultAnalyserConfig,
        ...defaultQueuesConfig
      }
    });

    const listeners = sd.listeners();
    if (listeners.length > 0) config.http.port = listeners[0];

    console.log(removeSensibleValues(config));

    try {
      const nodes = await createNodes(config);
      const repositories = await createRepositories(config);
      const queues = await createQueues(config, repositories);
      const server = await createServer(config, sd, queues, repositories, nodes);
    } catch (error) {
      console.log(error);
    }
  })
  .parse(process.argv);
