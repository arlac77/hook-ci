import { buildSchema } from "graphql";

export const Schema = buildSchema(`
  type Entry {
    name: String!
    isCollection: Boolean
    isBlob: Boolean
    content: String!
  }

  type PullRequest {
    id: String
    name: String!
    title: String
    source: Branch
    destination: Branch
    merged: Boolean
    locked: Boolean
  }

  type Hook {
    id: String!
    active: Boolean!
    url: String!
    events: [String]
  }

  type Branch {
    name: String!
    entries: [Entry]
    entry(name: String): Entry
  }

  type RepositoryGroup {
    id: String
    name: String!
    description: String
    repositories: [Repository]
    repository(name: String): Repository
  }

  type Repository {
    id: String
    name: String!
    fullName: String!
    condensedName: String!
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
    repositories(name: String): [Repository]
    group(name: String): RepositoryGroup
    groups(name: String): [RepositoryGroup]
    node(name: String): Node 
    queue(name: String): Queue 
  }
`);
