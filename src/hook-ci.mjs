import ServiceLDAP from "@kronos-integration/service-ldap";
import ServiceAuthenticator from "@kronos-integration/service-authenticator";
import ServiceRepositories from "@kronos-integration/service-repositories";
import {
  ServiceHTTP,
  CTXBodyParamInterceptor
} from "@kronos-integration/service-http";
import ServiceNodes from "./service-nodes.mjs";
import ServiceAnalyser from "./service-analyser.mjs";
import ServiceQeueus from "./service-queues.mjs";


export default async function setup(sp) {

  const POST = {
    method: "POST",
    interceptors: [new CTXBodyParamInterceptor()]
  };

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
    http: {
      type: ServiceHTTP,
      autostart: true,
      endpoints: {
        "/authenticate": { ...POST, connected: "service(auth).access_token" }
      }
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
}
