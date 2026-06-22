import { create } from 'zustand'
import type { NodeRunStatus } from '../types/workflow'

interface NodeRunState {
  status: NodeRunStatus
  outputData?: unknown
  errorMsg?: string | null
  startedAt?: string | null
  finishedAt?: string | null
}

interface RunState {
  activeRunId: string | null
  runStatus: 'idle' | 'running' | 'success' | 'failed'
  nodeStatuses: Record<string, NodeRunState>
  setActiveRun: (runId: string | null) => void
  setRunStatus: (status: RunState['runStatus']) => void
  setNodeStatus: (nodeId: string, state: NodeRunState) => void
  resetRun: () => void
  updateFromRunData: (nodeRuns: Array<{
    nodeId: string
    status: NodeRunStatus
    outputData?: unknown
    errorMsg?: string | null
    startedAt?: string | null
    finishedAt?: string | null
  }>) => void
}

function isSameNodeState(a: NodeRunState | undefined, b: NodeRunState): boolean {
  if (!a) return false
  return (
    a.status === b.status &&
    a.outputData === b.outputData &&
    a.errorMsg === b.errorMsg &&
    a.startedAt === b.startedAt &&
    a.finishedAt === b.finishedAt
  )
}

function isTerminal(status: NodeRunStatus): boolean {
  return status === 'SUCCESS' || status === 'FAILED'
}

function isRegression(prev: NodeRunState | undefined, next: NodeRunState): boolean {
  if (!prev) return false
  return isTerminal(prev.status) && !isTerminal(next.status)
}

export const useRunStore = create<RunState>((set) => ({
  activeRunId: null,
  runStatus: 'idle',
  nodeStatuses: {},

  setActiveRun: (runId) => set({ activeRunId: runId }),

  setRunStatus: (status) => set({ runStatus: status }),

  setNodeStatus: (nodeId, state) =>
    set((prev) => {
      const existing = prev.nodeStatuses[nodeId]
      if (isRegression(existing, state)) return prev
      if (isSameNodeState(existing, state)) return prev
      return { nodeStatuses: { ...prev.nodeStatuses, [nodeId]: state } }
    }),

  resetRun: () => set({ activeRunId: null, runStatus: 'idle', nodeStatuses: {} }),

  updateFromRunData: (nodeRuns) =>
    set((prev) => {
      let changed = false
      const next = { ...prev.nodeStatuses }
      for (const nr of nodeRuns) {
        const incoming: NodeRunState = {
          status: nr.status,
          outputData: nr.outputData,
          errorMsg: nr.errorMsg,
          startedAt: nr.startedAt,
          finishedAt: nr.finishedAt,
        }
        const existing = next[nr.nodeId]
        if (isRegression(existing, incoming)) continue
        if (!isSameNodeState(existing, incoming)) {
          next[nr.nodeId] = incoming
          changed = true
        }
      }
      return changed ? { nodeStatuses: next } : prev
    }),
}))
