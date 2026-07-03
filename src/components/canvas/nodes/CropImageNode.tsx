'use client'

import React, { memo, useCallback } from 'react'
import { Position } from '@xyflow/react'
import { useShallow } from 'zustand/react/shallow'
import { Crop } from 'lucide-react'
import { TypedHandle } from '../handles/TypedHandle'
import { HandleType } from '../../../lib/types/handles'
import { NodeKind, type CropImageData, type RequestInputsData } from '../../../lib/types/nodes'
import { useCanvasStore } from '../../../lib/store/canvas.store'
import { useRunStore } from '../../../lib/store/run.store'

const CROP_HANDLES = ['input-x-number', 'input-y-number', 'input-w-number', 'input-h-number'] as const
type CropHandle = (typeof CROP_HANDLES)[number]

interface Props {
  id: string
  data: CropImageData
}

function SliderField({
  label,
  value,
  onChange,
  handleId,
  overrideValue,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  handleId: string
  overrideValue?: number
}) {
  const connected = overrideValue !== undefined
  const displayValue = connected ? overrideValue : value
  const sliderValue = Math.min(100, Math.max(0, displayValue))

  return (
    <div className="relative space-y-1.5">
      <div className="absolute -left-3 top-1/2 -translate-y-1/2">
        <TypedHandle
          id={handleId}
          type="target"
          position={Position.Left}
          handleType={HandleType.NUMBER}
          label={label}
        />
      </div>
      <div className="flex justify-between text-sm text-gray-400">
        <span>{label}</span>
        <span className={connected ? 'text-pink-500 font-medium' : 'text-gray-600 font-medium'}>
          {displayValue}%
        </span>
      </div>
      <input
        type="range" min={0} max={100} value={sliderValue}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={connected}
        className={`w-full h-1 cursor-pointer ${connected ? 'accent-pink-500 opacity-70' : 'accent-blue-500'}`}
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

  const overrides = useCanvasStore(
    useShallow((s): Partial<Record<CropHandle, number>> => {
      const out: Partial<Record<CropHandle, number>> = {}
      for (const h of CROP_HANDLES) {
        const edge = s.edges.find((e) => e.target === id && e.targetHandle === h)
        if (!edge) continue
        const sourceNode = s.nodes.find((n) => n.id === edge.source)
        if (!sourceNode) continue
        const srcData = sourceNode.data
        if (srcData.kind !== NodeKind.REQUEST_INPUTS) continue
        const field = (srcData as RequestInputsData).fields.find((f) => f.id === edge.sourceHandle)
        if (!field) continue
        const n = Number(field.value)
        if (Number.isFinite(n)) out[h] = n
      }
      return out
    }),
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
          <span className="ml-auto text-[10px] font-medium tracking-wide uppercase bg-purple-500 text-white px-2 py-0.5 rounded-full animate-pulse">Running</span>
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

        <SliderField label="X Position %" value={data.xPct} onChange={(v) => update('xPct', v)} handleId="input-x-number" overrideValue={overrides['input-x-number']} />
        <SliderField label="Y Position %" value={data.yPct} onChange={(v) => update('yPct', v)} handleId="input-y-number" overrideValue={overrides['input-y-number']} />
        <SliderField label="Width %"      value={data.wPct} onChange={(v) => update('wPct', v)} handleId="input-w-number" overrideValue={overrides['input-w-number']} />
        <SliderField label="Height %"     value={data.hPct} onChange={(v) => update('hPct', v)} handleId="input-h-number" overrideValue={overrides['input-h-number']} />

        {typeof outputData?.['output-image'] === 'string' && (

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
