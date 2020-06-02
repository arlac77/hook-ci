import { dirname } from "path";
import { fileURLToPath } from "url";
import ServiceLDAP from "@kronos-integration/service-ldap";
import ServiceAuthenticator from "@kronos-integration/service-authenticator";
import ServiceRepositories from "@kronos-integration/service-repositories";
import ServiceNodes from "./service-nodes.mjs";
import ServiceAnalyser from "./service-analyser.mjs";
import ServiceQeueus from "./service-queues.mjs";

import { defaultServerConfig, initializeServer } from "./server.mjs";

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
    queues: {
      type: ServiceQeueus
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

  const config = {
    http: await sp.services.config.configFor("http", defaultServerConfig.http)
 };

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
    await initializeServer(bus);
  } catch (error) {
    console.log(error);
  }
}
