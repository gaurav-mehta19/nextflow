'use client'

import { memo, useEffect, useRef, useState } from 'react'
import type { StickyNoteData } from '../../../lib/types/nodes'
import { useCanvasStore } from '../../../lib/store/canvas.store'

interface Props {
  id: string
  data: StickyNoteData
  selected?: boolean
}

function StickyNoteNodeComponent({ id, data, selected }: Props) {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(data.text ?? '')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (editing) textareaRef.current?.focus()
  }, [editing])

  useEffect(() => {
    if (!editing) setDraft(data.text ?? '')
  }, [data.text, editing])

  const commit = () => {
    setEditing(false)
    if (draft !== data.text) updateNodeData(id, { text: draft } as Partial<StickyNoteData>)
  }

  return (
    <div
      onDoubleClick={() => setEditing(true)}
      className={`relative w-[160px] min-h-[140px] rounded-md bg-yellow-100 ${
        selected ? 'ring-2 ring-yellow-400/70' : ''
      }`}
      style={{
        boxShadow:
          '0 1px 2px rgba(133, 100, 4, 0.08), 0 6px 14px rgba(133, 100, 4, 0.10)',
      }}
    >
      {editing ? (
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setDraft(data.text ?? '')
              setEditing(false)
            }
          }}
          placeholder="Type a note..."
          className="w-full h-full min-h-[140px] resize-none bg-transparent p-3 text-[13px] text-gray-800 placeholder-gray-400 outline-none nodrag"
        />
      ) : (
        <div className="w-full h-full min-h-[140px] p-3 text-[13px] whitespace-pre-wrap break-words text-gray-800">
          {data.text?.trim() ? (
            data.text
          ) : (
            <span className="text-gray-400">Type a note...</span>
          )}
        </div>
      )}
    </div>
  )
}

export const StickyNoteNode = memo(StickyNoteNodeComponent)
