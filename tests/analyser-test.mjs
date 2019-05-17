import test from "ava";
import { join, dirname } from "path";
import { defaultRepositoriesConfig } from "../src/repositories.mjs";
import { analyseJob, defaultAnalyserConfig } from "../src/analyser.mjs";
import { processJob } from "../src/processor.mjs";
import { GithubProvider } from "github-repository-provider";

function makeJob(id, data) {
  return {
    id,
    progress() {},
    data
  };
}

test("analyser", async t => {
  const config = {
    ...defaultRepositoriesConfig,
    ...defaultAnalyserConfig,
    workspace: { dir: "/tmp" }
  };

  const job = makeJob(1, {
    event: "push",

    request: {
      ref: "refs/heads/template-sync-1",
      repository: {
        full_name: "arlac77/npm-template-sync-github-hook",

        url: "https://github.com/arlac77/npm-template-sync-github-hook"
      }
    }
  });

  let processData;
  const queues = {
    process: {
      async add(job) {
        processData = { ...job };
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
        ],
        options: {}
      },
      {
        name: "prepare",
        executable: "npm",
        args: ["install"],
        options: {
          cwd: "/tmp/1"
        },
        requirements
      },
      {
        name: "test",
        executable: "npm",
        args: ["run", "cover"],
        options: {
          cwd: "/tmp/1"
        },
        requirements
      },
      {
        name: "documentation",
        executable: "npm",
        args: ["run", "docs"],
        options: {
          cwd: "/tmp/1"
        },
        requirements
      },
      {
        name: "deploy",
        executable: "npx",
        args: ["semantic-release"],
        options: {
          cwd: "/tmp/1",
          localDir: "/tmp/1"
        },
        requirements
      }
    ]
  });

  console.log(processData);
  await processJob({ id: 2, data: processData }, config, queues, repositories);
});
