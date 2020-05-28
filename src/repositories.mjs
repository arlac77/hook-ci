import AggregationProvider from "aggregation-repository-provider";

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
      const m = await import(provider.type);

      delete provider.type;

      return m.default.initialize(
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
