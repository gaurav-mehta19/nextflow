'use client'

import { useCallback, useState, type ReactNode } from 'react'
import { useReactFlow, useStore, type Node } from '@xyflow/react'
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Undo2,
  Redo2,
  Command,
  LayoutGrid,
  Move,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { useCanvasStore } from '../../lib/store/canvas.store'
import { autoArrange } from '../../lib/dag/auto-arrange'
import type { NodeData } from '../../lib/types/nodes'

const zoomSelector = (s: { transform: [number, number, number] }) => s.transform[2]

export function CanvasToolbar(_props: { onSave?: () => void }) {
  const { zoomIn, zoomOut, zoomTo, fitView, getNodes } = useReactFlow<Node<NodeData>>()
  const zoom = useStore(zoomSelector)
  const undo = useCanvasStore((s) => s.undo)
  const redo = useCanvasStore((s) => s.redo)
  const setNodes = useCanvasStore((s) => s.setNodes)
  const selectMode = useCanvasStore((s) => s.selectMode)
  const toggleSelectMode = useCanvasStore((s) => s.toggleSelectMode)
  const [collapsed, setCollapsed] = useState(false)

  const zoomPct = Math.round(zoom * 100)

  const handleAutoArrange = useCallback(() => {
    const liveNodes = getNodes()
    const { edges } = useCanvasStore.getState()
    const arranged = autoArrange(liveNodes, edges)
    setNodes(arranged)
    setTimeout(() => fitView({ padding: 0.2, duration: 400 }), 50)
  }, [getNodes, setNodes, fitView])

  return (
    <>
      <div
        className="absolute bottom-4 left-4 z-40 flex items-center gap-1 bg-white border border-gray-100 rounded-2xl h-12 transition-[padding] duration-200 ease-out"
        style={{
          boxShadow: '0 1px 3px rgba(15,23,42,0.04), 0 6px 20px rgba(15,23,42,0.06)',
          paddingInline: collapsed ? 4 : 8,
        }}
      >
        {collapsed ? (
          <ToolbarBtn
            label="Show toolbar"
            shortcut="T"
            onClick={() => setCollapsed(false)}
          >
            <ChevronRight size={16} strokeWidth={2} />
          </ToolbarBtn>
        ) : (
          <>
            <ToolbarBtn
              label="Hide toolbar"
              shortcut="T"
              onClick={() => setCollapsed(true)}
            >
              <ChevronLeft size={16} strokeWidth={2} />
            </ToolbarBtn>

            <Divider />

            <ToolbarBtn label="Undo" shortcut="⌘Z" onClick={undo}>
              <Undo2 size={16} strokeWidth={2} />
            </ToolbarBtn>
            <ToolbarBtn label="Redo" shortcut="⌘⇧Z" onClick={redo}>
              <Redo2 size={16} strokeWidth={2} />
            </ToolbarBtn>
            <ToolbarBtn label="Keyboard shortcuts" shortcut="⌘K">
              <Command size={16} strokeWidth={2} />
            </ToolbarBtn>

            <Divider />

            <ToolbarBtn label="Zoom out" shortcut="−" onClick={() => zoomOut({ duration: 200 })}>
              <ZoomOut size={16} strokeWidth={2} />
            </ToolbarBtn>
            <button
              type="button"
              onClick={() => zoomTo(1, { duration: 200 })}
              title="Reset zoom"
              className="px-2 h-8 text-[13px] font-medium text-gray-500 hover:text-gray-900 rounded-md hover:bg-gray-100 transition-colors tabular-nums"
            >
              {zoomPct}%
            </button>
            <ToolbarBtn label="Zoom in" shortcut="+" onClick={() => zoomIn({ duration: 200 })}>
              <ZoomIn size={16} strokeWidth={2} />
            </ToolbarBtn>

            <Divider />

            <ToolbarBtn
              label="Fit View"
              shortcut="F"
              onClick={() => fitView({ padding: 0.15, duration: 300 })}
            >
              <Maximize2 size={16} strokeWidth={2} />
            </ToolbarBtn>
            <ToolbarBtn label="Auto-arrange" shortcut="Shift+A" onClick={handleAutoArrange}>
              <LayoutGrid size={16} strokeWidth={2} />
            </ToolbarBtn>
            <ToolbarBtn
              label="Select Node"
              shortcut="S"
              active={selectMode}
              onClick={toggleSelectMode}
            >
              <Move size={16} strokeWidth={2} />
            </ToolbarBtn>
          </>
        )}
      </div>
    </>
  )
}

function Divider() {
  return <div className="w-px h-5 bg-gray-200 mx-0.5" aria-hidden />
}

interface ToolbarBtnProps {
  label: string
  shortcut?: string
  onClick?: () => void
  disabled?: boolean
  active?: boolean
  children: ReactNode
}

function ToolbarBtn({ label, shortcut, onClick, disabled, active, children }: ToolbarBtnProps) {
  return (
    <div className="relative group">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        className={`flex items-center justify-center w-8 h-8 rounded-md transition-colors disabled:opacity-30 ${
          active
            ? 'bg-gray-100 text-gray-900'
            : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
        }`}
      >
        {children}
      </button>
      <Tooltip label={label} shortcut={shortcut} />
    </div>
  )
}

function Tooltip({ label, shortcut }: { label: string; shortcut?: string }) {
  return (
    <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-[opacity,transform] duration-150 z-50">
      <div className="flex items-center gap-1.5 bg-gray-900 text-white text-xs font-medium rounded-lg pl-3 pr-2 py-1.5 whitespace-nowrap shadow-lg">
        {label}
        {shortcut && (
          <span className="bg-gray-700/80 text-white text-[10px] font-semibold rounded px-1.5 py-0.5 leading-none">
            {shortcut}
          </span>
        )}
      </div>
    </div>
  )
}
