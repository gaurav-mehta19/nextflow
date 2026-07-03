'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowUpRight, Pencil, Trash2, Check, X, Download } from 'lucide-react'
import { formatDistanceToNow } from '../../lib/utils/time'
import { Badge } from '../ui/Badge'
import { WorkflowPreview } from './WorkflowPreview'

interface PreviewNode {
  id: string
  type?: string
  position: { x: number; y: number }
}

interface PreviewEdge {
  source: string
  target: string
}

interface WorkflowCardProps {
  id: string
  name: string
  updatedAt: string
  lastRunStatus?: string | null
  nodes?: PreviewNode[]
  edges?: PreviewEdge[]
  onDeleteRequest: (id: string, name: string) => void
  onRename: (id: string, name: string) => void
}

export function WorkflowCard({
  id, name, updatedAt, lastRunStatus, nodes = [], edges = [], onDeleteRequest, onRename,
}: WorkflowCardProps) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [draftName, setDraftName] = useState(name)

  const open = () => router.push(`/workflows/${id}/canvas`)

  const handleExport = (e: React.MouseEvent) => {
    e.stopPropagation()
    const link = document.createElement('a')
    link.href = `/api/workflows/${id}/export`
    link.download = `${name.replace(/[^a-z0-9]/gi, '_')}.json`
    link.click()
  }

  const commitRename = () => {
    if (draftName.trim() && draftName !== name) {
      onRename(id, draftName.trim())
    }
    setEditing(false)
  }

  const statusVariant = lastRunStatus === 'SUCCESS' ? 'success'
    : lastRunStatus === 'FAILED' ? 'error'
    : lastRunStatus === 'RUNNING' ? 'info'
    : 'default'

  return (
    <div className="group bg-white border border-gray-200 hover:border-purple-300 hover:shadow-lg rounded-2xl overflow-hidden transition-all flex flex-col">
      <div
        onClick={open}
        className="h-44 bg-gradient-to-br from-gray-50 to-purple-50/30 border-b border-gray-100 cursor-pointer overflow-hidden relative group/preview"
      >
        <WorkflowPreview nodes={nodes} edges={edges} />
        <div className="absolute inset-0 bg-purple-600/0 group-hover/preview:bg-purple-600/5 transition-colors flex items-center justify-center">
          <div className="opacity-0 group-hover/preview:opacity-100 transition-opacity bg-white shadow-md rounded-full px-3 py-1.5 flex items-center gap-1 text-xs font-medium text-purple-700">
            <ArrowUpRight size={14} />
            Open workflow
          </div>
        </div>
      </div>

      <div className="p-4 flex-1 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2 min-h-[24px]">
          {editing ? (
            <div className="flex items-center gap-1 flex-1 min-w-0">
              <input
                autoFocus
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename()
                  if (e.key === 'Escape') { setEditing(false); setDraftName(name) }
                }}
                className="flex-1 min-w-0 bg-gray-50 text-sm text-gray-800 rounded px-2 py-1 border border-purple-400 outline-none"
              />
              <button onClick={commitRename} className="text-green-500 hover:text-green-600 flex-shrink-0">
                <Check size={15} />
              </button>
              <button onClick={() => { setEditing(false); setDraftName(name) }} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
                <X size={15} />
              </button>
            </div>
          ) : (
            <h3 className="text-base font-semibold text-gray-900 truncate flex-1 min-w-0" title={name}>
              {name}
            </h3>
          )}
          {!editing && lastRunStatus && (
            <Badge variant={statusVariant as 'default' | 'success' | 'error' | 'warning' | 'info'}>
              {lastRunStatus.toLowerCase()}
            </Badge>
          )}
        </div>

        <p className="text-xs text-gray-400 -mt-2">
          Last edited {formatDistanceToNow(updatedAt)} · {nodes.length} {nodes.length === 1 ? 'node' : 'nodes'}
        </p>

        <div className="flex items-center gap-1 mt-auto pt-2 border-t border-gray-100">
          <button
            onClick={open}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg px-3 py-2 transition-colors"
          >
            <ArrowUpRight size={13} />
            Open
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setEditing(true) }}
            title="Rename"
            className="w-9 h-9 flex items-center justify-center text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={handleExport}
            title="Export JSON"
            className="w-9 h-9 flex items-center justify-center text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Download size={14} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDeleteRequest(id, name) }}
            title="Delete"
            className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
