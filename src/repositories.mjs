import { GithubProvider } from "github-repository-provider";
import { LocalProvider } from "local-repository-provider";
import { AggregationProvider } from "aggregation-repository-provider";

const pl = { "github-repository-provider" : GithubProvider, "local-repository-provider" : LocalProvider };

export const defaultRepositoriesConfig = {
  git: {
    clone: {
      depth: 5
    }
  },
  providers: [
    { type: "github-repository-provider", logLevel: "debug" }
  ]
};

export async function createRepositories(config) {
  const logger = function logger(...args) {
    console.log(...args);
  };

  const providers = await Promise.all(
    config.providers.map(async provider => {
      const providerFactory = pl[provider.type];

      //const rpm = await import(provider.type);
      //const providerFactory = rpm.default;
      delete provider.type;

      const options = {
        ...provider,
        logger,
        ...providerFactory.optionsFromEnvironment(process.env)
      };
      return new providerFactory(options);
    })
  );

  const aggregationProvider = new AggregationProvider(providers, { logger });

  return aggregationProvider;
}
