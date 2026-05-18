'use client'

import { MiniMap } from '@xyflow/react'

export function MiniMapPanel() {
  return (
    <MiniMap
      nodeColor={(node) => {
        switch (node.type) {
          case 'requestInputs': return '#4f46e5'
          case 'response': return '#059669'
          case 'cropImage': return '#2563eb'
          case 'gemini': return '#7c3aed'
          default: return '#374151'
        }
      }}
      maskColor="rgba(200,200,200,0.4)"
      className="!bg-white !border-gray-200 rounded-lg overflow-hidden !shadow-sm"
    />
  )
}
