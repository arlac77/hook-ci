import GraphQLHTTP from "koa-graphql";
import mount from "koa-mount";
import { Schema } from "./schema.mjs";

export function initGraphQL(bus) {
  const root = {
    branches: async ({name}) => {
      const result = [];
      for await (const r of bus.repositories.branches(name)) {
        result.push(r);
      }
      return result;
    },
    branch: async (params) => bus.repositories.branch(params.name),

    repositories: async ({name}) => {
      const result = [];
      for await (const r of bus.repositories.repositories(name)) {
        result.push(r);
      }
      return result;
    },
    repository: async (params) => bus.repositories.repository(params.name),

    groups: async ({name}) => {
      const result = [];
      for await (const r of bus.repositories.repositoryGroups(name)) {
        result.push(r);
      }
      return result;
    },
    group: async (params) => bus.repositories.repositoryGroup(params.name),
    node: async (params) => bus.nodes.find(node => node.name === params.name),
    nodes: async () => bus.nodes,
    queue: async (params) => bus.queues[params.name],
    queues: async () => Object.values(bus.queues)
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
