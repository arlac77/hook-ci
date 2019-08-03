import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { readFileSync } from "fs";


const here = dirname(fileURLToPath(import.meta.url));

export function makeJob(id, data={}) {
  return {
    id,
    progress() {},
    log(line) { console.log(line)},
    data
  };
}


export function makeConfig(port)
{
  return {
    version: 99,
    http: {
      port
    },
    auth: {
      users: {
        user1: {
          password: "secret",
          entitlements: ["ci","ci.nodes.read"]
        },
        user2: {
          password: "secret",
          entitlements: ["unknown"]
        }

      },
      jwt: {
        public: readFileSync(join(here, "fixtures", "demo.rsa.pub")),
        private: readFileSync(join(here,  "fixtures", "demo.rsa")),  
      }
    }
  };
}

export const sd = { notify: () => {}, listeners: () => [] };
