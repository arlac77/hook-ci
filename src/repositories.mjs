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
  providers: [{ type: GithubProvider }, { type: LocalProvider }]
};

export async function createRepositories(config) {
  const logOptions = {
    logger: (...args) => {
      console.log(...args);
    }
  };

  config.providders = defaultRepositoriesConfig.providers;

  console.log(config.providers);

  const providers = config.providers.map(
    provider =>
      new provider.type({
        logOptions,
        ...provider.type.optionsFromEnvironment(process.env)
      })
  );

  const aggregationProvider = new AggregationProvider(providers, logOptions);

  return aggregationProvider;
}
