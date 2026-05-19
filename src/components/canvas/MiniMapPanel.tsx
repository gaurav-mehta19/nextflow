'use client'

import { useState } from 'react'
import { MiniMap } from '@xyflow/react'
import { Map, X } from 'lucide-react'

const PANEL_SHADOW =
  '0 1px 3px rgba(15,23,42,0.04), 0 6px 20px rgba(15,23,42,0.06)'

export function MiniMapPanel() {
  const [open, setOpen] = useState(false)

  // Collapsed — just a compact rounded button at bottom-right
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        title="Show minimap"
        className={[
          'absolute bottom-4 right-4 z-40',
          'w-10 h-10 rounded-2xl',
          'bg-white/90 backdrop-blur-md border border-gray-100',
          'flex items-center justify-center',
          'text-gray-500 hover:text-gray-900 hover:bg-white',
          'transition-all duration-200 ease-out hover:scale-105',
        ].join(' ')}
        style={{ boxShadow: PANEL_SHADOW }}
      >
        <Map size={16} />
      </button>
    )
  }

  // Expanded — the React Flow MiniMap + an inset close button
  return (
    <>
      <MiniMap
        nodeColor={(node) => {
          switch (node.type) {
            case 'requestInputs': return '#818cf8'
            case 'response':      return '#34d399'
            case 'cropImage':     return '#60a5fa'
            case 'gemini':        return '#c084fc'
            default:              return '#a1a1aa'
          }
        }}
        nodeStrokeWidth={0}
        nodeBorderRadius={6}
        maskColor="rgba(244,244,245,0.6)"
        pannable
        zoomable
        position="bottom-right"
        className="!bg-white/95 backdrop-blur !border !border-gray-100 !rounded-xl overflow-hidden"
        style={{ boxShadow: PANEL_SHADOW }}
      />
      <button
        onClick={() => setOpen(false)}
        title="Hide minimap"
        className={[
          'absolute z-50',
          'w-6 h-6 rounded-full',
          'bg-white border border-gray-200',
          'flex items-center justify-center',
          'text-gray-500 hover:text-gray-900 hover:bg-gray-50',
          'transition-all duration-150 ease-out hover:scale-110',
          'shadow-sm',
        ].join(' ')}
        style={{ bottom: 170, right: 11 }}
      >
        <X size={12} />
      </button>
    </>
  )
}
