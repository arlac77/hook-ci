import GraphQLHTTP from "koa-graphql";
import mount from "koa-mount";
import { Schema } from "./schema.mjs";

export function initGraphQL(bus) {
  const root = {
    repository: async (params) => bus.repositories.repository(params.name),
    group: async (params) => bus.repositories.repositoryGroups(params.name),
    node: async (params) => bus.nodes.find(node => node.name === params.name),
    queue: async (params) => bus.queues[params.name]
  };

  bus.app.use(
    mount(
      "/graphql",
      GraphQLHTTP({
        schema: Schema,
        rootValue: root,
        graphiql: true
      })
    )
  );
}
