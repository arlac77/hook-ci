import { buildSchema } from "graphql";

export const Schema = buildSchema(`
  type Entry {
    name: String!
    content: String!
  }

  type Branch {
    name: String!
  }

  type RepositoryGroup {
    name: String!
    description: String
    repositories: [Repository]
  }

  type Repository {
    name: String!
    id: String
    description: String
    branches: [Branch]
  }

  type Query {
    repository(name: String): Repository
    group(name: String): RepositoryGroup
  }
`);
