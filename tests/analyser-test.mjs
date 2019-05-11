import test from "ava";
import { join, dirname } from "path";
import { analyseJob, defaultAnalyserConfig } from "../src/analyser.mjs";
import { GithubProvider } from "github-repository-provider";

test("analyser", async t => {
  const config = {
    ...defaultAnalyserConfig
  };
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
        processData = { steps:job.steps };
      }
    }
  };

  const repositories = new GithubProvider(
    GithubProvider.optionsFromEnvironment(process.env)
  );

  await analyseJob(job, config, queues, repositories);
  t.deepEqual(processData, {
    steps: [
      {
        name: "prepare",
        directory: ".",
        executable: "npm",
        args: ["install"]
      },
      {
        name: "test",
        directory: ".",
        executable: "npm",
        args: ["test"]
      },
      {
        name: "deploy",
        directory: ".",
        executable: "npx",
        args: ["semantic-release"],
        options: {
          localDir: "."
        }
      }
    ]
  });
});
