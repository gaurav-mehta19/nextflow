import type { Node, Edge } from '@xyflow/react'
import type { NodeData } from '../../types/nodes'

export interface NodeContext {
  runId: string
  nodeId: string
  nodeRunId: string
  nodes: Node<NodeData>[]
  edges: Edge[]
  inputValues: Record<string, unknown>
  resolvedInputs: Record<string, unknown>
  upstreamOutputs: Map<string, Record<string, unknown>>
}

export interface HandlerOutput {
  outputData: Record<string, unknown>
}
