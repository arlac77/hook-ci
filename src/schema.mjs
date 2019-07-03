import { buildSchema } from "graphql";

export const Schema = buildSchema(`
  type Entry {
    name: String!
    content: String!
  }

  type PullRequest {
    name: String!
    id: String
    title: String
    source: Branch
    destination: Branch
  }

  type Hook {
    id: String!
    url: String!
    events: [String]
  }

  type Branch {
    name: String!
  }

  type RepositoryGroup {
    name: String!
    id: String
    description: String
    repositories: [Repository]
    repository(name: String): Repository
  }

  type Repository {
    name: String!
    fullName: String!
    id: String
    description: String
    defaultBranchName: String
    owner: RepositoryGroup
    branches: [Branch]
    branch(name: String): Branch
    pullRequests: [PullRequest]
    hooks: [Hook]
  }

  type Job {
    id: String!
    state: String
  }

  type Queue {
    name: String!
    jobs: [Job]
  }

  type Node {
    name: String!
    version: String
    platform: String
    uptime: String
  }

  type Query {
    repository(name: String): Repository
    group(name: String): RepositoryGroup
    node(name: String): Node 
    queue(name: String): Queue 
  }
`);
