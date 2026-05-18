'use client'

import { useState } from 'react'
import { useReactFlow } from '@xyflow/react'
import { Plus, ZoomIn, ZoomOut, Maximize2, Undo2, Redo2 } from 'lucide-react'
import { useCanvasStore } from '../../lib/store/canvas.store'
import { NodePicker } from './NodePicker'

// onSave is still accepted but unused — autosave handles persistence.
// Kept in the signature so the canvas page doesn't need to change.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function CanvasToolbar(_props: { onSave?: () => void }) {
  const { zoomIn, zoomOut, fitView } = useReactFlow()
  const undo = useCanvasStore((s) => s.undo)
  const redo = useCanvasStore((s) => s.redo)
  const [pickerOpen, setPickerOpen] = useState(false)

  return (
    <>
      <NodePicker open={pickerOpen} onClose={() => setPickerOpen(false)} />

      {/* Bottom-left: canvas controls */}
      <div className="absolute bottom-4 left-4 z-40 flex items-center gap-0.5 bg-white/95 backdrop-blur border border-gray-200 rounded-xl px-2 py-1.5 shadow-lg">
        <button onClick={undo} title="Undo (Ctrl+Z)" className="toolbar-btn">
          <Undo2 size={15} />
        </button>
        <button onClick={redo} title="Redo (Ctrl+Shift+Z)" className="toolbar-btn">
          <Redo2 size={15} />
        </button>
        <div className="w-px h-5 bg-gray-200 mx-1" />
        <button onClick={() => zoomOut()} title="Zoom out" className="toolbar-btn">
          <ZoomOut size={15} />
        </button>
        <button onClick={() => zoomIn()} title="Zoom in" className="toolbar-btn">
          <ZoomIn size={15} />
        </button>
        <button onClick={() => fitView({ padding: 0.1 })} title="Fit view" className="toolbar-btn">
          <Maximize2 size={15} />
        </button>
      </div>

      {/* Bottom-center: + Add node */}
      <button
        onClick={() => setPickerOpen((p) => !p)}
        title="Add node"
        className={`absolute bottom-4 left-1/2 -translate-x-1/2 z-40 w-11 h-11 rounded-full flex items-center justify-center shadow-lg transition-colors ${
          pickerOpen
            ? 'bg-indigo-700 text-white ring-2 ring-indigo-300'
            : 'bg-indigo-600 hover:bg-indigo-500 text-white'
        }`}
      >
        <Plus size={20} />
      </button>
    </>
  )
}
