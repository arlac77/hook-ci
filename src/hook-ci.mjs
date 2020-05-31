import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { expand } from "config-expander";
import ServiceLDAP from "@kronos-integration/service-ldap";
import ServiceAuthenticator from "@kronos-integration/service-authenticator";

import { defaultServerConfig, initializeServer } from "./server.mjs";
import { initializeWebsockets } from "./websockets.mjs";
import { defaultQueuesConfig, initializeQueues } from "./queues.mjs";
import { defaultAnalyserConfig } from "./analyser.mjs";
import { defaultProcessorConfig } from "./processor.mjs";
import {
  defaultRepositoriesConfig,
  initializeRepositories
} from "./repositories.mjs";
import { defaultNodesConfig, initializeNodes } from "./nodes.mjs";

const here = dirname(fileURLToPath(import.meta.url));

export default async function setup(sp) {
  await sp.declareServices({
    auth: {
      type: ServiceAuthenticator,
      autostart: true,
      endpoints: {
        ldap: "service(ldap).authenticate"
      }
    },
    ldap: {
      type: ServiceLDAP
    }
  });

  await sp.start();

  console.log(
    await sp.services.config.configFor("server", defaultServerConfig.server)
  );

  const configDir = process.env.CONFIGURATION_DIRECTORY || args[1];

  const config = await expand(configDir ? "${include('config.json')}" : {}, {
    constants: {
      basedir: configDir || process.cwd(),
      installdir: resolve(here, "..")
    },
    default: {
      version: "1.0.0",
      nodename: "${os.hostname}",
      ...defaultNodesConfig,
      ...defaultRepositoriesConfig,
      ...defaultServerConfig,
      ...defaultProcessorConfig,
      ...defaultAnalyserConfig,
      ...defaultQueuesConfig
    }
  });

  if (Array.isArray(sp.services.config.listeningFileDescriptors)) {
    console.log(sp.services.config.listeningFileDescriptors);

    const l = sp.services.config.listeningFileDescriptors.find(
      l => (l.name = "http.listen.socket")
    );
    if (l) {
      config.http.port = l;
    }
  }

  console.log(config.http.port);

  const bus = { sp, config };

  try {
    await Promise.all([initializeNodes(bus), initializeRepositories(bus)]);
    await initializeQueues(bus);
    await initializeServer(bus);
    await initializeWebsockets(bus);
  } catch (error) {
    console.log(error);
  }
}
