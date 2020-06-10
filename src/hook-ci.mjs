import ServiceHealthCheck from "@kronos-integration/service-health-check";
import ServiceLDAP from "@kronos-integration/service-ldap";
import ServiceAuthenticator from "@kronos-integration/service-authenticator";
import ServiceRepositories from "@kronos-integration/service-repositories";
import {
  ServiceHTTP,
  CTXInterceptor,
  CTXJWTVerifyInterceptor,
  CTXBodyParamInterceptor
} from "@kronos-integration/service-http";
import ServiceNodes from "./service-nodes.mjs";
import ServiceAnalyser from "./service-analyser.mjs";
import ServiceQueues from "./service-queues.mjs";
import { DecodeJSONInterceptor } from "@kronos-integration/interceptor-decode-json";

export default async function setup(sp) {
  const GETInterceptors = [
    new CTXJWTVerifyInterceptor(),
    new CTXInterceptor({
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
        Expires: 0
      }
    })
  ];

  const GET = {
    interceptors: GETInterceptors
  };

  const POST = {
    method: "POST",
    interceptors: [new CTXBodyParamInterceptor()]
  };

  const WS = {
    ws: true,
    interceptors: [new DecodeJSONInterceptor()]
  };

  await sp.declareServices({
    auth: {
      type: ServiceAuthenticator,
      autostart: true,
      endpoints: {
        ldap: "service(ldap).authenticate",

        "/state/uptime": {
          ...WS,
          connected: "service(health).uptime"
        },
        "/state/cpu": {
          ...WS,
          connected: "service(health).cpu"
        },
        "/state/memory": {
          ...WS,
          connected: "service(health).memory"
        }
      }
    },
    ldap: {
      type: ServiceLDAP
    },
    health: {
      type: ServiceHealthCheck
    },
    repositories: {
      type: ServiceRepositories
    },
    queues: {
      type: ServiceQueues
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
