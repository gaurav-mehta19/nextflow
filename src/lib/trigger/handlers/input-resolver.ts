import type { Edge, Node } from '@xyflow/react'
import { NodeKind, type NodeData, type RequestInputsData } from '../../types/nodes'

export function directUpstreamIds(nodeId: string, edges: Edge[]): string[] {
  const seen = new Set<string>()
  for (const e of edges) {
    if (e.target === nodeId) seen.add(e.source)
  }
  return [...seen]
}

export function resolveNodeInputs(
  nodeId: string,
  edges: Edge[],
  upstreamOutputs: Map<string, Record<string, unknown>>,
): Record<string, unknown> {
  const incoming = edges.filter((e) => e.target === nodeId)
  const resolved: Record<string, unknown> = {}
  for (const edge of incoming) {
    const src = upstreamOutputs.get(edge.source) ?? {}
    const srcHandle = edge.sourceHandle ?? 'output'
    const tgtHandle = edge.targetHandle ?? 'input'
    const value = src[srcHandle]
    const existing = resolved[tgtHandle]
    if (existing !== undefined) {
      resolved[tgtHandle] = Array.isArray(existing)
        ? [...existing, value]
        : [existing, value]
    } else {
      resolved[tgtHandle] = value
    }
  }
  return resolved
}

export function requestInputsOutput(
  node: Node<NodeData>,
  inputValues: Record<string, unknown>,
): Record<string, unknown> {
  const data = node.data as RequestInputsData
  const out: Record<string, unknown> = {}
  for (const field of data.fields) {
    out[field.id] = inputValues[field.id] ?? null
  }
  return out
}

export function isExecutable(node: Node<NodeData>): boolean {
  return node.data.kind === NodeKind.CROP_IMAGE || node.data.kind === NodeKind.GEMINI
}

export function hasNoExecutableUpstream(
  node: Node<NodeData>,
  edges: Edge[],
  nodes: Node<NodeData>[],
): boolean {
  const upstreamIds = edges.filter((e) => e.target === node.id).map((e) => e.source)
  return upstreamIds.every((id) => {
    const u = nodes.find((n) => n.id === id)
    return !u || u.data.kind !== NodeKind.CROP_IMAGE && u.data.kind !== NodeKind.GEMINI
  })
}

export function isSinkExecutable(
  node: Node<NodeData>,
  edges: Edge[],
  nodes: Node<NodeData>[],
): boolean {
  if (!isExecutable(node)) return false
  const downstreams = edges.filter((e) => e.source === node.id).map((e) => e.target)
  if (downstreams.length === 0) return true
  return downstreams.every((id) => {
    const d = nodes.find((nn) => nn.id === id)
    return !d || d.data.kind === NodeKind.RESPONSE
  })
}
