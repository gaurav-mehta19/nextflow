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

export const useRunStore = create<RunState>((set) => ({
  activeRunId: null,
  runStatus: 'idle',
  nodeStatuses: {},

  setActiveRun: (runId) => set({ activeRunId: runId }),

  setRunStatus: (status) => set({ runStatus: status }),

  setNodeStatus: (nodeId, state) =>
    set((prev) => ({
      nodeStatuses: { ...prev.nodeStatuses, [nodeId]: state },
    })),

  resetRun: () =>
    set({ activeRunId: null, runStatus: 'idle', nodeStatuses: {} }),

  updateFromRunData: (nodeRuns) =>
    set((prev) => {
      const next = { ...prev.nodeStatuses }
      for (const nr of nodeRuns) {
        next[nr.nodeId] = {
          status: nr.status,
          outputData: nr.outputData,
          errorMsg: nr.errorMsg,
          startedAt: nr.startedAt,
          finishedAt: nr.finishedAt,
        }
      }
      return { nodeStatuses: next }
    }),
}))
