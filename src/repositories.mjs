import { GithubProvider } from "github-repository-provider";
import { GiteaProvider } from "gitea-repository-provider";
import { BitbucketProvider } from "bitbucket-repository-provider";
import { LocalProvider } from "local-repository-provider";
import { AggregationProvider } from "aggregation-repository-provider";

const pl = {
  "bitbucket-repository-provider": BitbucketProvider,
  "github-repository-provider": GithubProvider,
  "gitea-repository-provider": GiteaProvider,
  "local-repository-provider": LocalProvider
};

export const defaultRepositoriesConfig = {
  git: {
    clone: {
      depth: 5
    }
  },
  providers: [{ type: "github-repository-provider", logLevel: "debug" }]
};

export async function initializeRepositories(bus) {
  const config = bus.config;

  const logger = function logger(...args) {
    console.log(...args);
  };

  const providers = await Promise.all(
    config.providers.map(async provider => {
      const providerFactory = pl[provider.type];

      //const rpm = await import(provider.type);
      //const providerFactory = rpm.default;
      delete provider.type;

      return providerFactory.initialize(
        {
          ...provider,
          logger
        },
        process.env
      );
    })
  );

  bus.repositories = new AggregationProvider(providers, { logger });
}
