'use client'

import React, { memo, useCallback } from 'react'
import { Position } from '@xyflow/react'
import { Crop } from 'lucide-react'
import { TypedHandle } from '../handles/TypedHandle'
import { HandleType } from '../../../lib/types/handles'
import type { CropImageData } from '../../../lib/types/nodes'
import { useCanvasStore } from '../../../lib/store/canvas.store'
import { useRunStore } from '../../../lib/store/run.store'

interface Props {
  id: string
  data: CropImageData
}

function SliderField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm text-gray-400">
        <span>{label}</span>
        <span className="text-gray-600 font-medium">{value}%</span>
      </div>
      <input
        type="range" min={0} max={100} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1 accent-blue-500 cursor-pointer"
      />
    </div>
  )
}

function CropImageNodeComponent({ id, data }: Props) {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData)
  const nodeStatus = useRunStore((s) => s.nodeStatuses[id])
  const outputData = nodeStatus?.outputData as Record<string, unknown> | undefined

  const update = useCallback(
    (key: keyof CropImageData, value: number) => {
      updateNodeData(id, { [key]: value } as Partial<CropImageData>)
    },
    [id, updateNodeData]
  )

  const statusClass =
    nodeStatus?.status === 'RUNNING' ? 'node-running'
    : nodeStatus?.status === 'SUCCESS' ? 'node-success'
    : nodeStatus?.status === 'FAILED' ? 'node-failed'
    : ''

  return (
    <div className={`node-base ${statusClass}`}>
      <div className="node-header bg-gradient-to-r from-blue-50 to-sky-50/40 border-b border-blue-100/60">
        <div className="w-6 h-6 rounded-lg bg-white border border-blue-100 flex items-center justify-center flex-shrink-0">
          <Crop size={13} className="text-blue-500" />
        </div>
        <span className="text-[11px] font-semibold text-blue-700 uppercase tracking-[0.08em]">Crop Image</span>
        {nodeStatus?.status === 'RUNNING' && (
          <span className="ml-auto text-[10px] font-medium tracking-wide uppercase bg-indigo-500 text-white px-2 py-0.5 rounded-full animate-pulse">Running</span>
        )}
        {nodeStatus?.status === 'SUCCESS' && (
          <span className="ml-auto text-[10px] font-medium tracking-wide uppercase bg-green-500 text-white px-2 py-0.5 rounded-full">Done</span>
        )}
        {nodeStatus?.status === 'FAILED' && (
          <span className="ml-auto text-[10px] font-medium tracking-wide uppercase bg-red-500 text-white px-2 py-0.5 rounded-full">Failed</span>
        )}
      </div>

      <div className="p-4 space-y-3">
        <div className="relative flex items-center h-7">
          <div className="absolute -left-3">
            <TypedHandle id="input-image" type="target" position={Position.Left} handleType={HandleType.IMAGE} label="Input Image" />
          </div>
          <span className="ml-4 text-sm text-gray-400">Input Image</span>
        </div>

        <SliderField label="X Position %" value={data.xPct} onChange={(v) => update('xPct', v)} />
        <SliderField label="Y Position %" value={data.yPct} onChange={(v) => update('yPct', v)} />
        <SliderField label="Width %" value={data.wPct} onChange={(v) => update('wPct', v)} />
        <SliderField label="Height %" value={data.hPct} onChange={(v) => update('hPct', v)} />

        {typeof outputData?.['output-image'] === 'string' && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={outputData['output-image'] as string}
            alt="Cropped output"
            className="w-full rounded-lg border border-gray-200 object-contain max-h-32"
          />
        )}

        <div className="relative flex items-center justify-end h-7">
          <span className="mr-4 text-sm text-gray-400">Output Image</span>
          <div className="absolute -right-3">
            <TypedHandle id="output-image" type="source" position={Position.Right} handleType={HandleType.IMAGE} label="Output Image" />
          </div>
        </div>
      </div>
    </div>
  )
}

export const CropImageNode = memo(CropImageNodeComponent)
CropImageNode.displayName = 'CropImageNode'
