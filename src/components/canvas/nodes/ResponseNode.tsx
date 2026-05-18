'use client'

import React, { memo } from 'react'
import { Position } from '@xyflow/react'
import { TypedHandle } from '../handles/TypedHandle'
import { HandleType } from '../../../lib/types/handles'
import type { ResponseData } from '../../../lib/types/nodes'
import { useRunStore } from '../../../lib/store/run.store'

interface Props {
  id: string
  data: ResponseData
}

function ResponseNodeComponent({ id }: Props) {
  const nodeStatus = useRunStore((s) => s.nodeStatuses[id])
  const result = nodeStatus?.outputData
    ? (nodeStatus.outputData as Record<string, unknown>).result
    : null

  const statusClass =
    nodeStatus?.status === 'RUNNING' ? 'node-running'
    : nodeStatus?.status === 'SUCCESS' ? 'node-success'
    : nodeStatus?.status === 'FAILED' ? 'node-failed'
    : ''

  return (
    <div className={`node-base ${statusClass}`}>
      <div className="node-header bg-emerald-50 border-b border-emerald-100">
        <span className="text-sm font-semibold text-emerald-600 uppercase tracking-wider">Response</span>
        {nodeStatus?.status === 'SUCCESS' && (
          <span className="ml-auto text-xs bg-green-500 text-white px-2 py-0.5 rounded-full">Done</span>
        )}
        {nodeStatus?.status === 'FAILED' && (
          <span className="ml-auto text-xs bg-red-500 text-white px-2 py-0.5 rounded-full">Failed</span>
        )}
      </div>

      <div className="p-4 relative">
        <div className="absolute -left-3 top-1/2 -translate-y-1/2">
          <TypedHandle id="result" type="target" position={Position.Left} handleType={HandleType.TEXT} label="Result" />
        </div>

        {result ? (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-700 max-h-64 node-scroll whitespace-pre-wrap break-words">
            {String(result)}
          </div>
        ) : (
          <div className="text-sm text-gray-400 italic text-center py-4">
            Output will appear here after run
          </div>
        )}
      </div>
    </div>
  )
}

export const ResponseNode = memo(ResponseNodeComponent)
ResponseNode.displayName = 'ResponseNode'
