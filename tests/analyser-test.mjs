import test from "ava";
import { join, dirname } from "path";
import { analyseJob } from "../src/analyser.mjs";
import { GithubProvider } from "github-repository-provider";

test("analyser", async t => {
  const config = {};
  const job = {
    id: 1,
    data: {
      event: "push",
      ref: "refs/heads/template-sync-1",

      repository: {
        full_name: "arlac77/npm-template-sync-github-hook",

        url: "https://github.com/arlac77/npm-template-sync-github-hook"
      }
    }
  };
  let processData;
  const queues = {
    process: {
      async add(job) {
        processData = job;
      }
    }
  };

  const repositories = new GithubProvider(
    GithubProvider.optionsFromEnvironment(process.env)
  );

  await analyseJob(job, config, queues, repositories);
  t.deepEqual(processData, { steps: [{ type: "exec" }] });
});
