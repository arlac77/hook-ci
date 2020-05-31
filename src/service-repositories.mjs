import AggregationProvider from "aggregation-repository-provider";
import { Service } from "@kronos-integration/service";
import { mergeAttributes, createAttributes } from "model-attributes";

export class ServiceRepositories extends Service {
  static get configurationAttributes() {
    return mergeAttributes(
      super.configurationAttributes,
      createAttributes({
        git: {
          clone: {
            depth: 5
          }
        },
        providers: {}
      })
    );
  }

  /**
   * @return {string} 'repositories'
   */
  static get name() {
    return "repositories";
  }

  async _start() {
    await this._start();

    const logger = (...args) => this.info(...args);

    const providers = await Promise.all(
      this.providers.map(async provider => {
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

    this.provider = new AggregationProvider(providers, { logger });
  }
}

export default ServiceRepositories;
