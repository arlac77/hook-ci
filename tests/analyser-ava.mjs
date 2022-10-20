import test from "ava";
import { analyseJob } from "../src/service-analyser.mjs";
import GithubProvider from "github-repository-provider";
import { makeJob, makeConfig } from "./helpers/util.mjs";

test("analyser", async t => {
  const bus = {
    config: makeConfig(),
    repositories: GithubProvider.initialize(undefined, process.env),
    queues: {}
  };

  const job = makeJob(1, {
    event: "push",

    ref: "refs/heads/master",
    repository: {
      full_name: "arlac77/npm-template-sync-github-hook",

      url: "https://github.com/arlac77/npm-template-sync-github-hook"
    }
  });

  const processData = await analyseJob(job, bus);

  //console.log(JSON.stringify(processData, undefined, 2));

  const requirements = [
    {
      executable: "node",
      version: ">=14.3.0"
    }
  ];

  t.deepEqual(processData, {
    branch: "master",
    node: "testnode",
    wd: "1",
    repository: {
      full_name: "arlac77/npm-template-sync-github-hook",
      url: "https://github.com/arlac77/npm-template-sync-github-hook"
    },
    steps: [
      {
        timeout: 1800000,
        name: "git clone",
        executable: "git",
        args: [
          "clone",
          "--depth",
          5,
          "-b",
          "master",
          "https://github.com/arlac77/npm-template-sync-github-hook",
          "{{workspaceDirectory}}"
        ],
        options: {}
      },
      {
        timeout: 1800000,
        name: "prepare",
        executable: "npm",
        args: ["install"],
        options: {
          cwd: "{{workspaceDirectory}}"
        },
        requirements
      },
      {
        timeout: 1800000,
        name: "test",
        executable: "npm",
        args: ["run", "cover"],
        options: {
          cwd: "{{workspaceDirectory}}"
        },
        requirements
      },
      /*{
        timeout: 1800000,
        name: "lint",
        executable: "npm",
        args: ["run", "lint"],
        options: {
          cwd: "{{workspaceDirectory}}"
        },
        requirements
      },
      {
        timeout: 1800000,
        name: "documentation",
        executable: "npm",
        args: ["run", "docs"],
        options: {
          cwd: "{{workspaceDirectory}}"
        },
        requirements
      },*/
      {
        timeout: 1800000,
        name: "deploy",
        executable: "npx",
        args: ["semantic-release"],
        options: {
          cwd: "{{workspaceDirectory}}",
          localDir: "{{workspaceDirectory}}"
        },
        requirements
      }
    ]
  });

  //console.log(processData);
  //  await processJob( makeJob(2,processData), config, queues, repositories);
});
