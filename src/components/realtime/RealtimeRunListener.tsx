'use client'

import { useEffect } from 'react'
import { useRealtimeRunsWithTag } from '@trigger.dev/react-hooks'
import { useRunStore } from '../../lib/store/run.store'
import { useRealtimeToken } from './useRealtimeToken'
import { runTag, workflowTag } from '../../lib/trigger/tags'
import { triggerStatusToPhase } from '../../lib/trigger/status-map'
import type { NodeRunStatus } from '../../lib/types/workflow'

interface Props {
  workflowId: string
  dbRunId: string
}

interface NodeMetaState {
  status: NodeRunStatus
  startedAt?: string
  finishedAt?: string
  errorMsg?: string
  outputData?: Record<string, unknown>
}

type RealtimeRun = {
  status: string
  metadata?: Record<string, unknown>
  tags?: string[]
}

function applyNodeMetadata(
  metadata: Record<string, unknown> | undefined,
  setNodeStatus: (id: string, s: NodeMetaState) => void,
): void {
  if (!metadata) return
  for (const key of Object.keys(metadata)) {
    if (!key.startsWith('node_')) continue
    const nodeId = key.slice('node_'.length)
    const state = metadata[key] as NodeMetaState | undefined
    if (state?.status) setNodeStatus(nodeId, state)
  }
}

export function RealtimeRunListener({ workflowId, dbRunId }: Props) {
  const { token } = useRealtimeToken(workflowId)
  const setNodeStatus = useRunStore((s) => s.setNodeStatus)
  const setRunStatus = useRunStore((s) => s.setRunStatus)
  const setActiveRun = useRunStore((s) => s.setActiveRun)

  const { runs } = useRealtimeRunsWithTag(workflowTag(workflowId), {
    accessToken: token ?? undefined,
    enabled: !!token,
  }) as { runs: RealtimeRun[] }

  useEffect(() => {
    if (!runs || runs.length === 0) return
    const wantedTag = runTag(dbRunId)
    const active = runs.find((r) => r.tags?.includes(wantedTag))
    if (!active) return
    applyNodeMetadata(active.metadata, setNodeStatus)
    const next = triggerStatusToPhase(active.status)
    if (next === 'running') {
      setRunStatus('running')
    } else if (next === 'success') {
      setRunStatus('success')
      setActiveRun(null)
    } else if (next === 'failed') {
      setRunStatus('failed')
      setActiveRun(null)
    }
  }, [runs, dbRunId, setNodeStatus, setRunStatus, setActiveRun])

  return null
}
