import test from "ava";
import {
  defaultRepositoriesConfig,
  initializeRepositories
} from "../src/repositories.mjs";

test("repositories", async t => {
  const bus = {
    config: {
      ...defaultRepositoriesConfig
    }
  };

  await initializeRepositories(bus);

  t.truthy(bus.repositories);
  t.is(bus.repositories.providers[0].name, "GithubProvider");
});
