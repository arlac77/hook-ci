import { buildSchema } from "graphql/index.mjs";

export const schema = buildSchema(`
  type Entry {
    name: String!
    isCollection: Boolean
    isBlob: Boolean
    content: String!
  }

  type Issue {
    id: String!
    state: String!
  }

  type PullRequest {
    id: String
    number: String!
    title: String
    body: String
    source: Branch
    destination: Branch
    state: String!
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
    name: String!
    id: String
    uuid: String
    description: String
    repositories: [Repository]
    repository(name: String): Repository
  }

  type Repository {
    name: String!
    id: String
    uuid: String
    isArchived: Boolean!
    isDisabled: Boolean!
    isLocked: Boolean!
    description: String
    fullName: String!
    condensedName: String!
    urls: [String]
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
    exitCode: Int
    node: Node
  }

  type Job {
    id: Int!
    state: String
    attemptsMade: Int
    steps: [Step]
  }

  type Queue {
    name: String!
    jobs: [Job]
  }

  type NodeMemory {
    rss: Int
    heapTotal: Int
    heapUsed: Int
    external: Int  
  }

  type KeyValuePairs {
    key: String!
    value: String!
  }

  type Node {
    name: String!
    version: String!
    uptime: Float!
    env: [KeyValuePairs]
    memory: NodeMemory!
    isLocal: Boolean!
  }

  type Query {
    branch(name: String): Branch
    branches(name: String): [Branch]
    repository(name: String): Repository
    repositories(name: String): [Repository]
    group(name: String): RepositoryGroup
    groups(name: String): [RepositoryGroup]
    node(name: String): Node 
    nodes: [Node] 
    queue(name: String): Queue 
    queues: [Queue] 
  }
`);
