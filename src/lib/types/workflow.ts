export type RunStatus = 'RUNNING' | 'SUCCESS' | 'FAILED' | 'PARTIAL'
export type RunScope = 'FULL' | 'PARTIAL' | 'SINGLE'
export type NodeRunStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED'

export interface Workflow {
  id: string
  userId: string
  name: string
  nodes: unknown[]
  edges: unknown[]
  createdAt: string
  updatedAt: string
  runs?: Run[]
}

export interface Run {
  id: string
  workflowId: string
  status: RunStatus
  scope: RunScope
  startedAt: string
  finishedAt?: string | null
  nodeRuns?: NodeRun[]
}

export interface NodeRun {
  id: string
  runId: string
  nodeId: string
  nodeType: string
  status: NodeRunStatus
  inputData?: unknown
  outputData?: unknown
  startedAt?: string | null
  finishedAt?: string | null
  errorMsg?: string | null
}
