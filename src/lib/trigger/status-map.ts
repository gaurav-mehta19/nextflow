import type { RunStatus } from '../types/workflow'

export type TriggerPhase = 'running' | 'success' | 'failed' | 'idle'

export function triggerStatusToPhase(status: string): TriggerPhase {
  if (status === 'EXECUTING' || status === 'QUEUED' || status === 'WAITING_FOR_DEPLOY') {
    return 'running'
  }
  if (status === 'COMPLETED') return 'success'
  if (
    status === 'FAILED' ||
    status === 'CRASHED' ||
    status === 'CANCELED' ||
    status === 'SYSTEM_FAILURE'
  ) {
    return 'failed'
  }
  return 'idle'
}

export function triggerStatusToRunStatus(status: string): RunStatus | null {
  const phase = triggerStatusToPhase(status)
  if (phase === 'running') return 'RUNNING'
  if (phase === 'success') return 'SUCCESS'
  if (phase === 'failed') return 'FAILED'
  return null
}
