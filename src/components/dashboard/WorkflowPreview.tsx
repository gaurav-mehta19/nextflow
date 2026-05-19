'use client'

interface PreviewNode {
  id: string
  type?: string
  position: { x: number; y: number }
}

interface PreviewEdge {
  source: string
  target: string
}

interface WorkflowPreviewProps {
  nodes: PreviewNode[]
  edges: PreviewEdge[]
}

const NODE_COLORS: Record<string, string> = {
  requestInputs: '#818cf8', // indigo-400
  cropImage: '#60a5fa',     // blue-400
  gemini: '#c084fc',        // purple-400
  response: '#34d399',      // emerald-400
}

const NODE_W = 340
const NODE_H = 200

export function WorkflowPreview({ nodes, edges }: WorkflowPreviewProps) {
  if (!nodes || nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full text-xs text-gray-400 bg-gradient-to-br from-gray-50 to-white">
        <div className="w-10 h-10 rounded-full bg-gray-100 mb-1" />
        Empty workflow
      </div>
    )
  }

  const pad = 60
  const minX = Math.min(...nodes.map((n) => n.position.x)) - pad
  const minY = Math.min(...nodes.map((n) => n.position.y)) - pad
  const maxX = Math.max(...nodes.map((n) => n.position.x + NODE_W)) + pad
  const maxY = Math.max(...nodes.map((n) => n.position.y + NODE_H)) + pad
  const width = maxX - minX
  const height = maxY - minY

  return (
    <svg
      viewBox={`${minX} ${minY} ${width} ${height}`}
      className="w-full h-full block"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Edges first so they render under nodes */}
      {edges.map((edge, i) => {
        const src = nodes.find((n) => n.id === edge.source)
        const tgt = nodes.find((n) => n.id === edge.target)
        if (!src || !tgt) return null
        const x1 = src.position.x + NODE_W
        const y1 = src.position.y + NODE_H / 2
        const x2 = tgt.position.x
        const y2 = tgt.position.y + NODE_H / 2
        const midX = (x1 + x2) / 2
        return (
          <path
            key={i}
            d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
            stroke="#cbd5e1"
            strokeWidth="8"
            fill="none"
            opacity="0.7"
          />
        )
      })}

      {/* Nodes */}
      {nodes.map((node) => {
        const color = NODE_COLORS[node.type ?? ''] ?? '#9ca3af'
        return (
          <rect
            key={node.id}
            x={node.position.x}
            y={node.position.y}
            width={NODE_W}
            height={NODE_H}
            rx={28}
            ry={28}
            fill={color}
            opacity="0.92"
          />
        )
      })}
    </svg>
  )
}
