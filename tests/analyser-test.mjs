import test from "ava";
import { join, dirname } from "path";
import { defaultRepositoriesConfig } from "../src/repositories.mjs";
import { analyseJob, defaultAnalyserConfig } from "../src/analyser.mjs";
import { GithubProvider } from "github-repository-provider";

test("analyser", async t => {
  const config = {
    ...defaultRepositoriesConfig,
    ...defaultAnalyserConfig,
    workspace: { dir: "/tmp" }
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
        processData = { steps: job.steps };
      }
    }
  };

  const repositories = new GithubProvider(
    GithubProvider.optionsFromEnvironment(process.env)
  );

  await analyseJob(job, config, queues, repositories);

  //console.log(JSON.stringify(processData, undefined, 2));

  const requirements = [
    {
      executable: "node",
      version: ">=10.15.3"
    }
  ];

  t.deepEqual(processData, {
    steps: [
      {
        name: "git clone",
        executable: "git",
        args: [
          "clone",
          "--depth",
          5,
          "https://github.com/arlac77/npm-template-sync-github-hook",
          "/tmp/1"
        ]
      },
      {
        name: "prepare",
        directory: ".",
        executable: "npm",
        args: ["install"],
        requirements
      },
      {
        name: "test",
        directory: ".",
        executable: "npm",
        args: ["run", "cover"],
        requirements
      },
      {
        name: "documentation",
        directory: ".",
        executable: "npm",
        args: ["run", "docs"],
        requirements
      },
      {
        name: "deploy",
        directory: ".",
        executable: "npx",
        args: ["semantic-release"],
        options: {
          localDir: "."
        },
        requirements
      }
    ]
  });
});
