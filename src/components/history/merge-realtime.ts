import type { Run, NodeRun, NodeRunStatus } from '../../lib/types/workflow'
import { triggerStatusToRunStatus } from '../../lib/trigger/status-map'

export interface RealtimeRunSnapshot {
  id: string
  status: string
  tags?: string[]
  metadata?: Record<string, unknown>
  startedAt?: string | Date
  finishedAt?: string | Date
}

function toIsoString(value: string | Date | undefined): string | undefined {
  if (!value) return undefined
  return value instanceof Date ? value.toISOString() : value
}

interface NodeMetaState {
  status?: NodeRunStatus
  startedAt?: string
  finishedAt?: string
  errorMsg?: string
  outputData?: unknown
}

function dbRunIdFromTags(tags: string[] | undefined): string | null {
  const tag = tags?.find((t) => t.startsWith('run_'))
  return tag ? tag.slice('run_'.length) : null
}

function applyMetadataToNodeRuns(
  nodeRuns: NodeRun[],
  metadata: Record<string, unknown> | undefined,
): NodeRun[] {
  if (!metadata) return nodeRuns
  return nodeRuns.map((nr) => {
    const state = metadata[`node_${nr.nodeId}`] as NodeMetaState | undefined
    if (!state?.status) return nr
    return {
      ...nr,
      status: state.status,
      outputData: state.outputData ?? nr.outputData,
      errorMsg: state.errorMsg ?? nr.errorMsg,
      startedAt: state.startedAt ?? nr.startedAt,
      finishedAt: state.finishedAt ?? nr.finishedAt,
    }
  })
}

export function mergeRealtimeIntoRuns(
  existing: Run[],
  realtime: RealtimeRunSnapshot[],
): Run[] {
  if (realtime.length === 0) return existing
  const byDbId = new Map<string, Run>()
  for (const r of existing) byDbId.set(r.id, r)

  for (const rt of realtime) {
    const dbRunId = dbRunIdFromTags(rt.tags)
    if (!dbRunId) continue
    const current = byDbId.get(dbRunId)
    if (!current) continue
    const nextStatus = triggerStatusToRunStatus(rt.status)
    const updatedNodeRuns = current.nodeRuns
      ? applyMetadataToNodeRuns(current.nodeRuns, rt.metadata)
      : current.nodeRuns
    const nextStartedAt = toIsoString(rt.startedAt) ?? current.startedAt
    const nextFinishedAt = toIsoString(rt.finishedAt) ?? current.finishedAt
    byDbId.set(dbRunId, {
      ...current,
      status: nextStatus ?? current.status,
      startedAt: nextStartedAt,
      finishedAt: nextFinishedAt,
      nodeRuns: updatedNodeRuns,
    })
  }

  return existing.map((r) => byDbId.get(r.id) ?? r)
}
