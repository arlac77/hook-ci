import test from "ava";
import {
  initializeRepositories
} from "../src/repositories.mjs";

test("repositories", async t => {
  const bus = {
    config: {
      "providers": [
        {
          "type": "github-repository-provider"
        },
        {
          "type": "gitea-repository-provider"
        }
      ]
    }
  };

  await initializeRepositories(bus);

  t.truthy(bus.repositories);
  t.is(bus.repositories.providers[0].name, "GithubProvider");
  t.is(bus.repositories.providers[1].name, "GiteaProvider");
});
