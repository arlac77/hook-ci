import test from "ava";
import { defaultRepositoriesConfig } from "../src/repositories.mjs";
import { analyseJob, defaultAnalyserConfig } from "../src/analyser.mjs";
import { GithubProvider } from "github-repository-provider";
import { makeJob } from "./util.mjs";

test("analyser", async t => {
  const bus = {
    config: {
      ...defaultRepositoriesConfig,
      ...defaultAnalyserConfig,
      workspace: { dir: "/tmp" }
    },
    queues: {},
    repositories: GithubProvider.initialize(undefined, process.env)
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
      version: ">=12.12.0"
    }
  ];

  //console.log(processData);

  t.deepEqual(processData, {
    branch: "master",
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
      {
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
      },
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
