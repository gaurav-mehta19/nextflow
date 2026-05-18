'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ExternalLink, Pencil, Trash2, Check, X, Download } from 'lucide-react'
import { formatDistanceToNow } from '../../lib/utils/time'
import { Badge } from '../ui/Badge'

interface WorkflowCardProps {
  id: string
  name: string
  updatedAt: string
  lastRunStatus?: string | null
  onDeleteRequest: (id: string, name: string) => void
  onRename: (id: string, name: string) => void
}

export function WorkflowCard({ id, name, updatedAt, lastRunStatus, onDeleteRequest, onRename }: WorkflowCardProps) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [draftName, setDraftName] = useState(name)

  const handleExport = () => {
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
    <div className="group bg-white border border-gray-200 hover:border-gray-300 hover:shadow-sm rounded-xl p-4 transition-all">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="flex items-center gap-1">
              <input
                autoFocus
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename()
                  if (e.key === 'Escape') { setEditing(false); setDraftName(name) }
                }}
                className="flex-1 bg-gray-50 text-sm text-gray-800 rounded px-2 py-1 border border-indigo-400 outline-none"
              />
              <button onClick={commitRename} className="text-green-500 hover:text-green-600">
                <Check size={14} />
              </button>
              <button onClick={() => { setEditing(false); setDraftName(name) }} className="text-gray-400 hover:text-gray-600">
                <X size={14} />
              </button>
            </div>
          ) : (
            <h3 className="text-sm font-semibold text-gray-800 truncate">{name}</h3>
          )}
          <p className="text-xs text-gray-400 mt-1">{formatDistanceToNow(updatedAt)}</p>
        </div>

        {lastRunStatus && (
          <Badge variant={statusVariant as 'default' | 'success' | 'error' | 'warning' | 'info'}>
            {lastRunStatus}
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-2 mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => router.push(`/workflows/${id}/canvas`)}
          className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 transition-colors"
        >
          <ExternalLink size={12} /> Open
        </button>
        <button
          onClick={() => setEditing(true)}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition-colors"
        >
          <Pencil size={12} /> Rename
        </button>
        <button
          onClick={handleExport}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition-colors"
        >
          <Download size={12} /> Export
        </button>

        <button
          onClick={() => onDeleteRequest(id, name)}
          className="ml-auto flex items-center gap-1 text-xs text-gray-300 hover:text-red-500 transition-colors"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  )
}
