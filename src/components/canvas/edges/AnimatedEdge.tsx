'use client'

import { BaseEdge, getBezierPath, type EdgeProps } from '@xyflow/react'
import { HandleType, HANDLE_COLORS } from '../../../lib/types/handles'
import { useCanvasStore } from '../../../lib/store/canvas.store'

function inferColor(sourceHandle: string | null | undefined): string {
  if (!sourceHandle) return HANDLE_COLORS[HandleType.TEXT]
  if (sourceHandle.includes('image')) return HANDLE_COLORS[HandleType.IMAGE]
  if (sourceHandle.includes('video')) return HANDLE_COLORS[HandleType.VIDEO]
  if (sourceHandle.includes('audio')) return HANDLE_COLORS[HandleType.AUDIO]
  if (sourceHandle.includes('file')) return HANDLE_COLORS[HandleType.FILE]
  return HANDLE_COLORS[HandleType.TEXT]
}

export function AnimatedEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
}: EdgeProps) {
  const sourceHandle = useCanvasStore((s) => s.edges.find((e) => e.id === id)?.sourceHandle)

  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature: 0.4,
  })

  const color = selected ? '#6366f1' : inferColor(sourceHandle)

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      style={{
        stroke: color,
        strokeWidth: selected ? 2.5 : 2,
        strokeLinecap: 'round',
        opacity: selected ? 1 : 0.85,
      }}
    />
  )
}
