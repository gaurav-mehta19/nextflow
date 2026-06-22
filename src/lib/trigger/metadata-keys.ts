import { metadata } from '@trigger.dev/sdk'
import type { NodeRunStatus } from '../types/workflow'

export interface NodeRealtimeState {
  status: NodeRunStatus
  startedAt?: string
  finishedAt?: string
  errorMsg?: string
  outputData?: Record<string, unknown>
}

const nodeKey = (nodeId: string) => `node_${nodeId}`

function setNodeMeta(nodeId: string, state: NodeRealtimeState): void {

  metadata.root.set(nodeKey(nodeId), state as unknown as Parameters<typeof metadata.root.set>[1])
}

export function metaSetRunning(nodeId: string): void {
  setNodeMeta(nodeId, {
    status: 'RUNNING',
    startedAt: new Date().toISOString(),
  })
}

export function metaSetSuccess(
  nodeId: string,
  startedAt: string,
  outputData: Record<string, unknown>,
): void {
  setNodeMeta(nodeId, {
    status: 'SUCCESS',
    startedAt,
    finishedAt: new Date().toISOString(),
    outputData,
  })
}

export function metaSetFailed(nodeId: string, errorMsg: string): void {
  setNodeMeta(nodeId, {
    status: 'FAILED',
    finishedAt: new Date().toISOString(),
    errorMsg,
  })
}
