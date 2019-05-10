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
  providers: [GithubProvider, LocalProvider]
};

export async function createRepositories(config) {
  const providers = [];

  const logOptions = {
    logger: (...args) => {
      console.log(...args);
    }
  };

  config.providers.forEach(provider => {
    const options = {
      logOptions,
      ...properties[provider.name],
      ...provider.optionsFromEnvironment(process.env)
    };
    providers.push(new provider(options));
  });

  const aggregationProvider = new AggregationProvider(providers, logOptions);

  return aggregationProvider;
}
