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
import { StandaloneServiceProvider } from "@kronos-integration/service";

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
  .action(() => initialize())
  .parse(process.argv);

async function setup(sp)
{
    sp.start();

    //console.log(Object.keys(sp.services));

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

    //console.log(sp.services.config.listeners);

    const l = sp.services.config.listeners.find(l => l.name = 'http.listen.socket');
    if(l) {
      config.http.port = l; 
    }

    console.log(config.http.port);

    //console.log(removeSensibleValues(config));

    const bus = { sd: { notify: str => sp.notify(str)}, config };

    try {
      await Promise.all([initializeNodes(bus), initializeRepositories(bus)]);
      await initializeQueues(bus);
      await initializeServer(bus);
      await initializeWebsockets(bus);
    } catch (error) {
      console.log(error);
    }
  }

async function initialize() {
  try {
    let serviceProvider;
    try {
      const m = await import("@kronos-integration/service-systemd");
      serviceProvider = new m.default();
    } catch (e) {
      serviceProvider = new StandaloneServiceProvider(
        JSON.parse(
          readFileSync(join(args[1], "config.json"), { encoding: "utf8" })
        )
      );
    }

    await setup(serviceProvider);
  } catch (error) {
    console.error(error);
  }
}
