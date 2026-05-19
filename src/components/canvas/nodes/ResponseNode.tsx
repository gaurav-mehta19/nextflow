'use client'

import React, { memo } from 'react'
import { Position } from '@xyflow/react'
import { TypedHandle } from '../handles/TypedHandle'
import { HandleType } from '../../../lib/types/handles'
import type { ResponseData } from '../../../lib/types/nodes'
import { useRunStore } from '../../../lib/store/run.store'
import { ResponseWithImages } from '../ResponseWithImages'

interface Props {
  id: string
  data: ResponseData
}

function ResponseNodeComponent({ id }: Props) {
  const nodeStatus = useRunStore((s) => s.nodeStatuses[id])
  const outputData = nodeStatus?.outputData as Record<string, unknown> | undefined
  const result = outputData?.result
  const imageUrls = Array.isArray(outputData?.imageUrls) ? (outputData.imageUrls as string[]) : []

  const statusClass =
    nodeStatus?.status === 'RUNNING' ? 'node-running'
    : nodeStatus?.status === 'SUCCESS' ? 'node-success'
    : nodeStatus?.status === 'FAILED' ? 'node-failed'
    : ''

  return (
    <div className={`node-base ${statusClass}`}>
      <div className="node-header bg-gradient-to-r from-emerald-50 to-teal-50/40 border-b border-emerald-100/60">
        <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-[0.08em]">Response</span>
        {nodeStatus?.status === 'SUCCESS' && (
          <span className="ml-auto text-[10px] font-medium tracking-wide uppercase bg-green-500 text-white px-2 py-0.5 rounded-full">Done</span>
        )}
        {nodeStatus?.status === 'FAILED' && (
          <span className="ml-auto text-[10px] font-medium tracking-wide uppercase bg-red-500 text-white px-2 py-0.5 rounded-full">Failed</span>
        )}
      </div>

      <div className="p-4 relative">
        <div className="absolute -left-3 top-1/2 -translate-y-1/2">
          <TypedHandle id="result" type="target" position={Position.Left} handleType={HandleType.TEXT} label="Result" />
        </div>

        {result ? (
          <div className="nowheel bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm max-h-[520px] node-scroll">
            <ResponseWithImages text={String(result)} imageUrls={imageUrls} />
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
