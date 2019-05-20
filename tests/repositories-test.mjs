import test from "ava";
import {
  defaultRepositoriesConfig,
  createRepositories
} from "../src/repositories.mjs";

test("repositories", async t => {
  const config = {
    ...defaultRepositoriesConfig
  };

  const repositories = await createRepositories(config);

  t.truthy(repositories);
  t.is(repositories.providers[0].name, "GithubProvider");
});
