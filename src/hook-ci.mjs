import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { expand } from "config-expander";
import ServiceLDAP from "@kronos-integration/service-ldap";
import ServiceAuthenticator from "@kronos-integration/service-authenticator";
import ServiceRepositories from "./service-repositories.mjs";
import ServiceNodes from "./service-nodes.mjs";
import ServiceAnalyser from "./service-analyser.mjs";

import { defaultServerConfig, initializeServer } from "./server.mjs";
import { defaultQueuesConfig, initializeQueues } from "./queues.mjs";

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
    },
    repositories: {
      type: ServiceRepositories
    },
    nodes: {
      type: ServiceNodes
    },
    analyser: {
      type: ServiceAnalyser,
      entries: {
        exclude: ["!test/**/*", "!tests/**/*"]
      },
      refs: {
        exclude: "^refs\\/tags"
      },
      analyser: [
        {
          type: "npm",
          logLevel: "debug"
        },
        {
          type: "pkgbuild"
        }
      ]
    }
  });

  await sp.start();

  console.log(
    await sp.services.config.configFor("http", defaultServerConfig.http)
  );
  console.log(
    await sp.services.config.configFor("queues", defaultQueuesConfig.queues)
  );

  const configDir = process.env.CONFIGURATION_DIRECTORY || process.argv[3];

  const config = await expand(configDir ? "${include('config.json')}" : {}, {
    constants: {
      basedir: configDir || process.cwd(),
      installdir: resolve(here, "..")
    },
    default: {
      version: "1.0.0",
      nodename: "${os.hostname}",
      ...defaultServerConfig,
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
    await initializeQueues(bus);
    await initializeServer(bus);
  } catch (error) {
    console.log(error);
  }
}
