'use client'

import { BaseEdge, getBezierPath, type EdgeProps } from '@xyflow/react'
import { HANDLE_COLORS, inferHandleType } from '../../../lib/types/handles'
import { useCanvasStore } from '../../../lib/store/canvas.store'

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

  const color = selected ? '#6366f1' : HANDLE_COLORS[inferHandleType(sourceHandle)]

  // Render the path manually instead of <BaseEdge> so we can apply the
  // marching-ants animation class. BaseEdge doesn't forward className to the
  // underlying path; raw <path> gives us full control.
  return (
    <path
      id={id}
      d={edgePath}
      fill="none"
      className={`nf-edge-flow ${selected ? 'nf-edge-flow--selected' : ''}`}
      style={{
        stroke: color,
        strokeWidth: selected ? 2.5 : 2,
        strokeLinecap: 'round',
        opacity: selected ? 1 : 0.85,
      }}
    />
  )
}
