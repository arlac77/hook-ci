import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { readFileSync } from "fs";
import { defaultRepositoriesConfig } from "../src/repositories.mjs";
import { defaultAnalyserConfig } from "../src/analyser.mjs";

const here = dirname(fileURLToPath(import.meta.url));

export const secret = "aSecret";
export const hook = "webhook";

export function makeJob(id, data = {}) {
  return {
    id,
    progress() {},
    log(line) {
      console.log(line);
    },
    data
  };
}

export function makeConfig(port=1234) {
  return {
    ...defaultRepositoriesConfig,
    ...defaultAnalyserConfig,
    nodename: "testnode",
    version: 99,
    http: {
      port,
      hooks : {
        github: {
          path: hook,
          secret,
          queue: "incoming"
        }
      }  
    },
    auth: {
      users: {
        user1: {
          password: "secret",
          entitlements: ["ci", "ci.nodes.read"]
        },
        user2: {
          password: "secret",
          entitlements: ["unknown"]
        }
      },
      jwt: {
        options: {
          algorithm: "RS256",
          expiresIn: "12h"
        },
        public: readFileSync(join(here, "fixtures", "demo.rsa.pub")),
        private: readFileSync(join(here, "fixtures", "demo.rsa"))
      }
    }
  };
}

export const sd = { notify: () => {}, listeners: () => [] };

export function makeQueue(name) {
  const queue = {
    name,
    async getJobLogs(job, from = 0, to = 10) {
      const lines = [];

      while (from < to) {
        lines.push(`line ${from}`);
        from++;
      }

      return { lines, count: 37 };
    },
    async clean() {},
    async empty() {},
    async pause() {},
    
    async add(data) {
      return { id: 77, queue: { name: "incoming", data } };
    },
    async getJobs() {
      return [
        {
          id: 1,
          data: {
            event: "push",
            repository: { full_name: "repo1" },
            ref: "refs/heads/template-sync-1"
          }
        },
        {
          id: 2,
          data: {
            event: "push",
            repository: { full_name: "repo2" },
            ref: "refs/heads/template-sync-2"
          }
        }
      ];
    },
    getActiveCount() {
      return 0;
    },
    getWaitingCount() {
      return 0;
    },
    getPausedCount() {
      return 0;
    },
    getCompletedCount() {
      return 0;
    },
    getFailedCount() {
      return 0;
    },
    getDelayedCount() {
      return 0;
    }
  };

  return queue;
}
