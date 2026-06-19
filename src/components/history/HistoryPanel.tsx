'use client'

import { useEffect, useState } from 'react'
import { History, RefreshCw } from 'lucide-react'
import { RunRow } from './RunRow'
import type { Run } from '../../lib/types/workflow'
import { useRunStore } from '../../lib/store/run.store'

interface HistoryPanelProps {
  workflowId: string
}

export function HistoryPanel({ workflowId }: HistoryPanelProps) {
  const [runs, setRuns] = useState<Run[]>([])
  const [loading, setLoading] = useState(true)
  const activeRunId = useRunStore((s) => s.activeRunId)
  const updateFromRunData = useRunStore((s) => s.updateFromRunData)
  const setRunStatus = useRunStore((s) => s.setRunStatus)
  const setActiveRun = useRunStore((s) => s.setActiveRun)

  const fetchRuns = async () => {
    try {
      const res = await fetch(`/api/workflows/${workflowId}/runs`)
      if (res.ok) {
        const data = await res.json() as { runs: Run[] }
        setRuns(data.runs)

        const runningRun = data.runs.find((r) => r.status === 'RUNNING')
        const seedRun = runningRun ?? data.runs[0]
        if (seedRun?.nodeRuns) {
          updateFromRunData(
            seedRun.nodeRuns.map((nr) => ({
              nodeId: nr.nodeId,
              status: nr.status,
              outputData: nr.outputData,
              errorMsg: nr.errorMsg,
              startedAt: nr.startedAt,
              finishedAt: nr.finishedAt,
            }))
          )
        }
        if (runningRun) {
          setActiveRun(runningRun.id)
          setRunStatus('running')
        }
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!activeRunId) return

    let cancelled = false
    let interval: ReturnType<typeof setInterval> | null = null

    const poll = async () => {
      const res = await fetch(`/api/workflows/${workflowId}/runs`)
      if (!res.ok || cancelled) return
      const data = await res.json() as { runs: Run[] }
      setRuns(data.runs)

      const active = data.runs.find((r) => r.id === activeRunId)
      if (!active) return

      if (active.nodeRuns) {
        updateFromRunData(
          active.nodeRuns.map((nr) => ({
            nodeId: nr.nodeId,
            status: nr.status,
            outputData: nr.outputData,
            errorMsg: nr.errorMsg,
            startedAt: nr.startedAt,
            finishedAt: nr.finishedAt,
          }))
        )
      }

      if (active.status !== 'RUNNING') {
        setRunStatus(active.status === 'SUCCESS' ? 'success' : 'failed')
        if (interval) clearInterval(interval)
        setActiveRun(null)
      }
    }

    void poll()
    interval = setInterval(() => { void poll() }, 2000)
    return () => {
      cancelled = true
      if (interval) clearInterval(interval)
    }
  }, [activeRunId, workflowId, updateFromRunData, setRunStatus, setActiveRun])

  useEffect(() => {
    void fetchRuns()

  }, [workflowId])

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <History size={14} className="text-gray-400" />
          <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Run History</span>
        </div>
        <button
          onClick={() => { void fetchRuns() }}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <RefreshCw size={13} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
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
