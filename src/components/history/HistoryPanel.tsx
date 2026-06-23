'use client'

import { useEffect, useRef, useState } from 'react'
import { History, RefreshCw } from 'lucide-react'
import { useRealtimeRunsWithTag } from '@trigger.dev/react-hooks'
import { RunRow } from './RunRow'
import type { Run, NodeRunStatus } from '../../lib/types/workflow'
import { useRunStore } from '../../lib/store/run.store'
import { useRealtimeToken } from '../realtime/useRealtimeToken'
import { workflowTag } from '../../lib/trigger/tags'
import { mergeRealtimeIntoRuns, type RealtimeRunSnapshot } from './merge-realtime'

interface HistoryPanelProps {
  workflowId: string
}

export function HistoryPanel({ workflowId }: HistoryPanelProps) {
  const [runs, setRuns] = useState<Run[]>([])
  const [initialLoading, setInitialLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const updateFromRunData = useRunStore((s) => s.updateFromRunData)
  const setRunStatus = useRunStore((s) => s.setRunStatus)
  const setActiveRun = useRunStore((s) => s.setActiveRun)
  const activeRunId = useRunStore((s) => s.activeRunId)
  const lastFetchedActiveRunId = useRef<string | null>(null)
  const { token } = useRealtimeToken(workflowId)

  const { runs: realtimeRuns } = useRealtimeRunsWithTag(workflowTag(workflowId), {
    accessToken: token ?? undefined,
    enabled: !!token,
  }) as { runs: RealtimeRunSnapshot[] }

  const fetchRuns = async (opts?: { initial?: boolean }) => {
    const { initial = false } = opts ?? {}
    if (initial) setInitialLoading(true)
    else setRefreshing(true)
    try {
      const res = await fetch(`/api/workflows/${workflowId}/runs`)
      if (!res.ok) return
      const data = (await res.json()) as { runs: Run[] }
      setRuns(data.runs)

      const runningRun = data.runs.find((r) => r.status === 'RUNNING')
      const seedRun = runningRun ?? data.runs[0]
      if (seedRun?.nodeRuns) {
        updateFromRunData(
          seedRun.nodeRuns.map((nr) => ({
            nodeId: nr.nodeId,
            status: nr.status as NodeRunStatus,
            outputData: nr.outputData,
            errorMsg: nr.errorMsg,
            startedAt: nr.startedAt,
            finishedAt: nr.finishedAt,
          })),
        )
      }
      if (runningRun) {
        lastFetchedActiveRunId.current = runningRun.id
        setActiveRun(runningRun.id)
        setRunStatus('running')
      }
    } finally {
      if (initial) setInitialLoading(false)
      else setRefreshing(false)
    }
  }

  useEffect(() => {
    void fetchRuns({ initial: true })

  }, [workflowId])


  useEffect(() => {
    if (!activeRunId) return
    if (lastFetchedActiveRunId.current === activeRunId) return
    lastFetchedActiveRunId.current = activeRunId
    void fetchRuns()

  }, [activeRunId])


  useEffect(() => {
    if (!realtimeRuns || realtimeRuns.length === 0) return
    setRuns((prev) => mergeRealtimeIntoRuns(prev, realtimeRuns))
  }, [realtimeRuns])

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <History size={14} className="text-gray-400" />
          <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Run History</span>
        </div>
        <button
          onClick={() => { void fetchRuns() }}
          className={`text-gray-400 hover:text-gray-600 transition-colors ${refreshing ? 'animate-spin' : ''}`}
        >
          <RefreshCw size={13} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {initialLoading ? (
          <div className="flex items-center justify-center py-8">
            <span className="text-xs text-gray-400">Loading…</span>
          </div>
        ) : runs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center px-4">
            <History size={24} className="text-gray-300 mb-2" />
            <p className="text-xs text-gray-400">No runs yet</p>
            <p className="text-xs text-gray-300 mt-1">Run your workflow to see history</p>
          </div>
        ) : (
          runs.map((run) => <RunRow key={run.id} run={run} />)
        )}
      </div>
    </div>
  )
}
