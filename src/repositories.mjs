import execa from "execa";
import { GithubProvider } from "github-repository-provider";
import { LocalProvider } from "local-repository-provider";
import { AggregationProvider } from "aggregation-repository-provider";

export const defaultRepositoriesConfig = {
  git: {
    clone: {
      depth: 10
    }
  },
  workspace: { dir: "${first(env.STATE_DIRECTORY,'/tmp/hook-ci')}" },
  providers: [{ type: "github-repository-provider" }, { type: "local-repository-provider" }]
};

export async function createRepositories(config) {
  const logOptions = {
    logger: (...args) => {
      console.log(...args);
    }
  };

  const px = [GithubProvider,LocalProvider];

  const providers = px.map(
    provider =>
      new provider({
        logOptions,
        ...provider.optionsFromEnvironment(process.env)
      })
  );

  const aggregationProvider = new AggregationProvider(providers, logOptions);

  return aggregationProvider;
}
