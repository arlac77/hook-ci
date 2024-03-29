import ServiceHealthCheck from "@kronos-integration/service-health";
import ServiceLDAP from "@kronos-integration/service-ldap";
import ServiceAuthenticator from "@kronos-integration/service-authenticator";
import ServiceRepositories from "@kronos-integration/service-repositories";
import {
  ServiceHTTP,
  CTXInterceptor,
  CTXJWTVerifyInterceptor,
  CTXBodyParamInterceptor
} from "@kronos-integration/service-http";
import { DecodeJSONInterceptor } from "@kronos-integration/interceptor-decode-json";
import { GithubHookInterceptor } from "@kronos-integration/interceptor-webhook";
import ServiceNodes from "./service-nodes.mjs";
import ServiceAnalyser from "./service-analyser.mjs";
import ServiceQueues from "./service-queues.mjs";
import { ServiceHooks } from "./service-hooks.mjs";

export default async function initialize(sp) {
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
    interceptors: new CTXBodyParamInterceptor()
  };

  const WS = {
    ws: true,
    interceptors: new DecodeJSONInterceptor()
  };

  await sp.declareServices({
    authenticator: {
      type: ServiceAuthenticator,
      autostart: true,
      endpoints: {
        "ldap.authenticate": "service(ldap).authenticate"
      }
    },
    ldap: {
      type: ServiceLDAP
    },
    health: {
      type: ServiceHealthCheck
    },
    repositories: {
      type: ServiceRepositories,
      providers: [
        {
          type: "github-repository-provider"
        }
      ]
    },
    hooks: {
      type: ServiceHooks
    },
    queues: {
      type: ServiceQueues
    },
    http: {
      type: ServiceHTTP,
      autostart: true,
      endpoints: {
        "/authenticate": { ...POST, connected: "service(authenticator).access_token" },

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
        },
        "POST:/webhook": {
          interceptors: [
            new GithubHookInterceptor({ secret: process.env.WEBHOOK_SECRET })
          ],
          connected: "service(hooks).push"
        }
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
}
