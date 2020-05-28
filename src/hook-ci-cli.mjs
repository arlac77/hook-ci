import { readFileSync } from "fs";
import { resolve, join, dirname } from "path";
import { fileURLToPath } from "url";

import program from "commander";
import { expand } from "config-expander";
import { removeSensibleValues } from "remove-sensible-values";
import { defaultServerConfig, initializeServer } from "./server.mjs";
import { initializeWebsockets } from "./websockets.mjs";
import { defaultQueuesConfig, initializeQueues } from "./queues.mjs";
import { defaultAnalyserConfig } from "./analyser.mjs";
import { defaultProcessorConfig } from "./processor.mjs";
import { defaultAuthConfig } from "./auth.mjs";
import {
  defaultRepositoriesConfig,
  initializeRepositories
} from "./repositories.mjs";
import { defaultNodesConfig, initializeNodes } from "./nodes.mjs";

const here = dirname(fileURLToPath(import.meta.url));

const { version, description } = JSON.parse(
  readFileSync(
    join(here, "..", "package.json"),
    { encoding: "utf8" }
  )
);

program
  .version(version)
  .description(description)
  .option("-c, --config <dir>", "use config directory")
  .action(async () => {
    let sd = { notify: () => {}, listeners: () => [] };

    try {
      sd = await import("sd-daemon");
    } catch (e) {}

    sd.notify("READY=1\nSTATUS=starting");

    const configDir = process.env.CONFIGURATION_DIRECTORY || program.config;

    const config = await expand(configDir ? "${include('config.json')}" : {}, {
      constants: {
        basedir: configDir || process.cwd(),
        installdir: resolve(here, "..")
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

    const bus = { sd, config };

    try {
      await Promise.all([initializeNodes(bus), initializeRepositories(bus)]);
      await initializeQueues(bus);
      await initializeServer(bus);
      await initializeWebsockets(bus);
    } catch (error) {
      console.log(error);
    }
  })
  .parse(process.argv);
