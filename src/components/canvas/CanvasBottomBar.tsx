'use client'

import { useState, type ReactNode } from 'react'
import { useReactFlow } from '@xyflow/react'
import { Plus, StickyNote } from 'lucide-react'
import { NodeKind, type StickyNoteData } from '../../lib/types/nodes'
import { useCanvasStore } from '../../lib/store/canvas.store'
import { NodePicker } from './NodePicker'

export function CanvasBottomBar() {
  const [pickerOpen, setPickerOpen] = useState(false)
  const addNode = useCanvasStore((s) => s.addNode)
  const { screenToFlowPosition } = useReactFlow()

  const handleAddSticky = () => {
    const center = screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    })
    const data: StickyNoteData = { kind: NodeKind.STICKY_NOTE, text: '' }
    addNode({
      id: `stickyNote-${crypto.randomUUID()}`,
      type: 'stickyNote',
      position: {
        x: center.x + (Math.random() * 80 - 40),
        y: center.y + (Math.random() * 80 - 40),
      },
      data,
    })
  }

  return (
    <>
      <NodePicker open={pickerOpen} onClose={() => setPickerOpen(false)} />

      <div
        className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1 bg-white border border-gray-100 rounded-2xl h-12 px-2"
        style={{ boxShadow: '0 1px 3px rgba(15,23,42,0.04), 0 6px 20px rgba(15,23,42,0.06)' }}
      >
        <BottomBarBtn label="Add Sticky Note" onClick={handleAddSticky}>
          <StickyNote size={17} strokeWidth={1.75} />
        </BottomBarBtn>
        <BottomBarBtn
          label="Add Node"
          onClick={() => setPickerOpen((p) => !p)}
          active={pickerOpen}
        >
          <Plus size={18} strokeWidth={2} />
        </BottomBarBtn>
      </div>
    </>
  )
}

interface BottomBarBtnProps {
  label: string
  onClick?: () => void
  active?: boolean
  children: ReactNode
}

function BottomBarBtn({ label, onClick, active, children }: BottomBarBtnProps) {
  return (
    <div className="relative group">
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className={`flex items-center justify-center w-9 h-9 rounded-md transition-colors ${
          active ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }`}
      >
        {children}
      </button>
      <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-[opacity,transform] duration-150">
        <div className="bg-gray-900 text-white text-xs font-medium rounded-lg px-3 py-1.5 whitespace-nowrap shadow-lg">
          {label}
        </div>
      </div>
    </div>
  )
}
