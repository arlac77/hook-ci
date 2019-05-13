import execa from "execa";
import { GithubProvider } from "github-repository-provider";
import { LocalProvider } from "local-repository-provider";
import { AggregationProvider } from "aggregation-repository-provider";

export const defaultRepositoriesConfig = {
  git: {
    clone: {
      depth: 5
    }
  },
  providers: [
    { type: "github-repository-provider", logLevel: "debug" },
    { type: "local-repository-provider", logLevel: "info" }
  ]
};

export async function createRepositories(config) {
  const logger = function logger(...args) {
    console.log(...args);
  };

  const providers = await Promise.all(
    config.providers.map(async provider => {
      const rpm = await import(provider.type);
      const providerFactory = rpm.default;
      delete provider.type;

      const options = {
        ...provider,
        logger,
        ...providerFactory.optionsFromEnvironment(process.env)
      };
      console.log(providerFactory, options);
      return new providerFactory(options);
    })
  );

  const aggregationProvider = new AggregationProvider(providers, { logger });

  return aggregationProvider;
}
