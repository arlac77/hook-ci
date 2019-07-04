import { buildSchema } from "graphql";

export const Schema = buildSchema(`
  type Entry {
    name: String!
    isCollection: Boolean
    isBlob: Boolean
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
    entries: [Entry]
    entry(name: String): Entry
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

  type Requirement {
    executable: String
    version: String
  }

  type Step {
    name: String!
    executable: String
    args: [String]
    requirements: [Requirement]
  }

  type Job {
    id: String!
    state: String
    attemptsMade: Int,
    steps: [Step]
  }

  type Queue {
    name: String!
    active: Boolean
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
