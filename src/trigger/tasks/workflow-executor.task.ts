import { metadata, task } from '@trigger.dev/sdk'
import type { Edge, Node } from '@xyflow/react'
import { NodeKind, type NodeData } from '../../lib/types/nodes'
import {
  hasNoExecutableUpstream,
  isExecutable,
  isSinkExecutable,
  requestInputsOutput,
  resolveNodeInputs,
} from '../../lib/trigger/handlers/input-resolver'
import {
  finalizeRun,
  writeRequestInputsSuccess,
  writeResponseSuccess,
} from '../../lib/trigger/db-hooks'
import { metaSetFailed, metaSetRunning, metaSetSuccess } from '../../lib/trigger/metadata-keys'
import { kindTag, nodeTag } from '../../lib/trigger/tags'
import { nodeRunnerTask, type NodeRunnerResult } from './node-runner.task'

interface ExecutorPayload {
  runId: string
  workflowId: string
  nodes: Node<NodeData>[]
  edges: Edge[]
  inputValues: Record<string, unknown>
}

async function resolveRequestInputs(
  payload: ExecutorPayload,
  outputs: Map<string, Record<string, unknown>>,
): Promise<void> {
  const { runId, nodes, inputValues } = payload
  const requestInputsNodes = nodes.filter((n) => n.data.kind === NodeKind.REQUEST_INPUTS)
  for (const n of requestInputsNodes) {
    const out = requestInputsOutput(n, inputValues)
    outputs.set(n.id, out)
    const startedAt = new Date().toISOString()
    metaSetRunning(n.id)
    await writeRequestInputsSuccess(runId, n.id, out)
    metaSetSuccess(n.id, startedAt, out)
  }
  await metadata.flush()
}

async function executeSinks(
  payload: ExecutorPayload,
  outputs: Map<string, Record<string, unknown>>,
): Promise<void> {
  const { runId, nodes, edges, inputValues } = payload
  const executables = nodes.filter(isExecutable)
  if (executables.length === 0) return

  for (const node of executables) {
    if (hasNoExecutableUpstream(node, edges, nodes)) {
      metaSetRunning(node.id)
    }
  }
  await metadata.flush()

  const sinks = executables.filter((n) => isSinkExecutable(n, edges, nodes))
  if (sinks.length === 0) return

  const items = sinks.map((u) => ({
    payload: { runId, nodeId: u.id, nodes, edges, inputValues },
    options: {
      idempotencyKey: `nodeRun:${runId}:${u.id}`,
      idempotencyKeyTTL: '1h',
      tags: [nodeTag(u.id), kindTag(u.data.kind)],
    },
  }))

  const batch = await nodeRunnerTask.batchTriggerAndWait(items)
  for (let i = 0; i < batch.runs.length; i++) {
    const r = batch.runs[i]
    const nodeId = sinks[i].id
    if (r.ok) {
      outputs.set(nodeId, (r.output as NodeRunnerResult).outputData)
    } else {
      const message = r.error instanceof Error ? r.error.message : String(r.error ?? 'unknown')
      console.error(`[workflow-executor] sink ${nodeId} failed:`, r.error)
      metaSetFailed(nodeId, message)
    }
  }
  await metadata.flush()
}

async function resolveResponseNodes(
  payload: ExecutorPayload,
  outputs: Map<string, Record<string, unknown>>,
): Promise<void> {
  const { runId, nodes, edges } = payload
  const responseNodes = nodes.filter((n) => n.data.kind === NodeKind.RESPONSE)
  for (const n of responseNodes) {
    const resolved = resolveNodeInputs(n.id, edges, outputs)
    const imageUrls: string[] = []
    const incoming = edges.filter((e) => e.target === n.id)
    for (const edge of incoming) {
      const src = outputs.get(edge.source) ?? {}
      const srcImages = src['imageUrls']
      if (Array.isArray(srcImages)) {
        for (const u of srcImages) {
          if (typeof u === 'string' && u.length > 0 && !imageUrls.includes(u)) imageUrls.push(u)
        }
      }
    }
    const out = { result: resolved['result'] ?? null, imageUrls }
    outputs.set(n.id, out)
    const startedAt = new Date().toISOString()
    metaSetRunning(n.id)
    await writeResponseSuccess(runId, n.id, resolved, out)
    metaSetSuccess(n.id, startedAt, out)
  }
}

export const workflowExecutorTask = task({
  id: 'workflow-executor',
  maxDuration: 1800,

  run: async (payload: ExecutorPayload): Promise<{ status: string }> => {
    const { runId } = payload

    const outputs = new Map<string, Record<string, unknown>>()
    await resolveRequestInputs(payload, outputs)
    await executeSinks(payload, outputs)
    await resolveResponseNodes(payload, outputs)

    const status = await finalizeRun(runId)
    await metadata.flush()
    return { status }
  },
})
