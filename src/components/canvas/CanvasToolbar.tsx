'use client'

import { useState } from 'react'
import { useReactFlow } from '@xyflow/react'
import {
  Plus, ZoomIn, ZoomOut, Maximize2, Undo2, Redo2, ChevronRight, X,
} from 'lucide-react'
import { useCanvasStore } from '../../lib/store/canvas.store'
import { NodePicker } from './NodePicker'

// onSave is still accepted but unused — autosave handles persistence.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function CanvasToolbar(_props: { onSave?: () => void }) {
  const { zoomIn, zoomOut, fitView } = useReactFlow()
  const undo = useCanvasStore((s) => s.undo)
  const redo = useCanvasStore((s) => s.redo)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [controlsOpen, setControlsOpen] = useState(false)

  return (
    <>
      <NodePicker open={pickerOpen} onClose={() => setPickerOpen(false)} />

      {/* Bottom-left: collapsible controls */}
      <div
        className={[
          'absolute bottom-4 left-4 z-40',
          'bg-white/90 backdrop-blur-md',
          'border border-gray-100 rounded-2xl',
          'flex items-center gap-0.5 px-1.5 py-1.5',
          'transition-[width] duration-200 ease-out overflow-hidden',
        ].join(' ')}
        style={{
          boxShadow: '0 1px 3px rgba(15,23,42,0.04), 0 6px 20px rgba(15,23,42,0.06)',
          width: controlsOpen ? 244 : 40,
        }}
      >
        {controlsOpen ? (
          <>
            <button onClick={undo} title="Undo (⌘Z)" className="toolbar-btn">
              <Undo2 size={15} />
            </button>
            <button onClick={redo} title="Redo (⌘⇧Z)" className="toolbar-btn">
              <Redo2 size={15} />
            </button>
            <div className="w-px h-5 bg-gray-200 mx-1" />
            <button onClick={() => zoomOut()} title="Zoom out" className="toolbar-btn">
              <ZoomOut size={15} />
            </button>
            <button onClick={() => zoomIn()} title="Zoom in" className="toolbar-btn">
              <ZoomIn size={15} />
            </button>
            <button onClick={() => fitView({ padding: 0.15, duration: 300 })} title="Fit view" className="toolbar-btn">
              <Maximize2 size={15} />
            </button>
            <div className="w-px h-5 bg-gray-200 mx-1" />
            <button
              onClick={() => setControlsOpen(false)}
              title="Collapse"
              className="toolbar-btn"
            >
              <X size={14} />
            </button>
          </>
        ) : (
          <button
            onClick={() => setControlsOpen(true)}
            title="Show canvas controls"
            className="toolbar-btn"
          >
            <ChevronRight size={15} />
          </button>
        )}
      </div>

      {/* Bottom-center: + Add node (always visible — primary affordance) */}
      <button
        onClick={() => setPickerOpen((p) => !p)}
        title="Add node"
        className={[
          'absolute bottom-4 left-1/2 -translate-x-1/2 z-40',
          'w-11 h-11 rounded-full',
          'flex items-center justify-center',
          'transition-all duration-200 ease-out',
          pickerOpen
            ? 'bg-indigo-700 text-white ring-4 ring-indigo-100 scale-105'
            : 'bg-indigo-600 hover:bg-indigo-500 text-white hover:scale-105',
        ].join(' ')}
        style={{
          boxShadow: pickerOpen
            ? '0 4px 14px rgba(79,70,229,0.4), 0 1px 3px rgba(15,23,42,0.06)'
            : '0 4px 14px rgba(79,70,229,0.25), 0 1px 3px rgba(15,23,42,0.06)',
        }}
      >
        <Plus size={20} strokeWidth={2.5} />
      </button>
    </>
  )
}
