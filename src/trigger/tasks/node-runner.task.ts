import { task } from '@trigger.dev/sdk'
import type { Edge, Node } from '@xyflow/react'
import { NodeKind, type NodeData } from '../../lib/types/nodes'
import {
  directUpstreamIds,
  isExecutable,
  requestInputsOutput,
  resolveNodeInputs,
} from '../../lib/trigger/handlers/input-resolver'
import { runExecutableNode } from '../../lib/trigger/handlers/dispatch'
import {
  getNodeRunByNodeId,
  markFailedByNode,
  markRunning,
  markSuccess,
} from '../../lib/trigger/db-hooks'
import { writeNodeFailed, writeNodeRunning, writeNodeSuccess } from '../../lib/trigger/metadata-keys'
import { kindTag, nodeTag } from '../../lib/trigger/tags'

interface NodeRunnerPayload {
  runId: string
  nodeId: string
  nodes: Node<NodeData>[]
  edges: Edge[]
  inputValues: Record<string, unknown>
}

export interface NodeRunnerResult {
  outputData: Record<string, unknown>
}

async function resolveUpstreamOutputs(
  payload: NodeRunnerPayload,
): Promise<Map<string, Record<string, unknown>>> {
  const { runId, nodeId, nodes, edges, inputValues } = payload
  const upstreamIds = directUpstreamIds(nodeId, edges)
  const outputs = new Map<string, Record<string, unknown>>()

  const executableUpstream: Node<NodeData>[] = []
  for (const upstreamId of upstreamIds) {
    const u = nodes.find((n) => n.id === upstreamId)
    if (!u) continue
    if (u.data.kind === NodeKind.REQUEST_INPUTS) {
      outputs.set(upstreamId, requestInputsOutput(u, inputValues))
    } else if (isExecutable(u)) {
      executableUpstream.push(u)
    }
  }

  if (executableUpstream.length === 0) return outputs

  const items = executableUpstream.map((u) => ({
    payload: { runId, nodeId: u.id, nodes, edges, inputValues } satisfies NodeRunnerPayload,
    options: {
      idempotencyKey: `nodeRun:${runId}:${u.id}`,
      idempotencyKeyTTL: '1h',
      tags: [nodeTag(u.id), kindTag(u.data.kind)],
    },
  }))

  const batch = await nodeRunnerTask.batchTriggerAndWait(items)

  for (let i = 0; i < batch.runs.length; i++) {
    const u = executableUpstream[i]
    const r = batch.runs[i]
    if (!r.ok) {
      const msg = r.error instanceof Error ? r.error.message : String(r.error ?? 'unknown')
      throw new Error(`Upstream "${u.id}" failed: ${msg}`)
    }
    outputs.set(u.id, (r.output as NodeRunnerResult).outputData)
  }
  return outputs
}

export const nodeRunnerTask = task({
  id: 'node-runner',
  maxDuration: 600,

  onFailure: async ({ payload, error }) => {
    const { runId, nodeId } = payload
    const msg = error instanceof Error ? error.message : String(error)
    await markFailedByNode(runId, nodeId, msg)
    await writeNodeFailed(nodeId, msg)
  },

  run: async (payload: NodeRunnerPayload): Promise<NodeRunnerResult> => {
    const { runId, nodeId, nodes, edges, inputValues } = payload
    const node = nodes.find((n) => n.id === nodeId)
    if (!node) throw new Error(`Node not found in payload: ${nodeId}`)

    const upstreamOutputs = await resolveUpstreamOutputs(payload)
    const resolvedInputs = resolveNodeInputs(nodeId, edges, upstreamOutputs)

    const ownRow = await getNodeRunByNodeId(runId, nodeId)
    if (!ownRow) throw new Error(`NodeRun row missing for node ${nodeId}`)

    const startedAt = new Date().toISOString()
    await markRunning(ownRow.id, resolvedInputs)
    await writeNodeRunning(nodeId)

    const { outputData } = await runExecutableNode(
      { runId, nodeId, nodeRunId: ownRow.id, nodes, edges, inputValues, resolvedInputs, upstreamOutputs },
      node,
    )

    await markSuccess(ownRow.id, outputData)
    await writeNodeSuccess(nodeId, startedAt, outputData)

    return { outputData }
  },
})
