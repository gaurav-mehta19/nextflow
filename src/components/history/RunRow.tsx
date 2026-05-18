'use client'

import { useState } from 'react'
import {
  ChevronDown, ChevronRight, Clock, CheckCircle2, XCircle, AlertTriangle, AlertCircle,
} from 'lucide-react'
import type { Run, NodeRun } from '../../lib/types/workflow'
import { formatDistanceToNow } from '../../lib/utils/time'

function StatusIcon({ status, size = 14 }: { status: string; size?: number }) {
  switch (status) {
    case 'SUCCESS': return <CheckCircle2 size={size} className="text-green-500" />
    case 'FAILED':  return <XCircle size={size} className="text-red-500" />
    case 'RUNNING': return <Clock size={size} className="text-blue-500 animate-spin" />
    case 'PENDING': return <Clock size={size} className="text-gray-300" />
    case 'PARTIAL': return <AlertTriangle size={size} className="text-yellow-500" />
    default:        return <AlertCircle size={size} className="text-gray-400" />
  }
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    SUCCESS: 'bg-green-50 text-green-600 border border-green-200',
    FAILED:  'bg-red-50 text-red-600 border border-red-200',
    RUNNING: 'bg-blue-50 text-blue-600 border border-blue-200',
    PENDING: 'bg-gray-50 text-gray-500 border border-gray-200',
    PARTIAL: 'bg-yellow-50 text-yellow-600 border border-yellow-200',
  }
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${map[status] ?? 'bg-gray-100 text-gray-500'}`}>
      {status}
    </span>
  )
}

function fmtDuration(start?: string | null, end?: string | null, runningPlaceholder = '—'): string {
  if (!start) return runningPlaceholder
  if (!end) return runningPlaceholder
  const ms = new Date(end).getTime() - new Date(start).getTime()
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function NodeRunRow({ nr }: { nr: NodeRun }) {
  const [expanded, setExpanded] = useState(false)
  const duration = fmtDuration(nr.startedAt, nr.finishedAt, nr.status === 'RUNNING' ? 'Running…' : '—')
  const hasDetails = !!(nr.inputData || nr.outputData || nr.errorMsg)

  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <button
        className="w-full flex items-center gap-2 py-1.5 px-2 text-xs hover:bg-gray-50 transition-colors text-left"
        onClick={() => hasDetails && setExpanded((p) => !p)}
        disabled={!hasDetails}
      >
        {hasDetails ? (
          expanded
            ? <ChevronDown size={11} className="text-gray-400 flex-shrink-0" />
            : <ChevronRight size={11} className="text-gray-400 flex-shrink-0" />
        ) : (
          <span className="w-[11px] flex-shrink-0" />
        )}
        <StatusIcon status={nr.status} />
        <span className="text-gray-600 flex-1 truncate">
          {nr.nodeType}{' '}
          <span className="text-gray-400 font-mono text-[10px]">({nr.nodeId.slice(-6)})</span>
        </span>
        <span className="text-gray-400 text-[11px]">{duration}</span>
      </button>

      {expanded && hasDetails && (
        <div className="ml-4 pl-2 pr-2 pb-2 space-y-2 border-l-2 border-gray-100 text-[11px]">
          {nr.errorMsg && (
            <DetailBlock label="Error" tone="error">
              {nr.errorMsg}
            </DetailBlock>
          )}
          {nr.inputData !== null && nr.inputData !== undefined && (
            <DetailBlock label="Input">
              {prettyJSON(nr.inputData)}
            </DetailBlock>
          )}
          {nr.outputData !== null && nr.outputData !== undefined && (
            <DetailBlock label="Output">
              {prettyJSON(nr.outputData)}
            </DetailBlock>
          )}
          {(nr.startedAt || nr.finishedAt) && (
            <div className="text-[10px] text-gray-400 px-1">
              {nr.startedAt && <span>started {new Date(nr.startedAt).toLocaleTimeString()}</span>}
              {nr.startedAt && nr.finishedAt && <span> · </span>}
              {nr.finishedAt && <span>finished {new Date(nr.finishedAt).toLocaleTimeString()}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function DetailBlock({
  label, children, tone = 'default',
}: {
  label: string
  children: React.ReactNode
  tone?: 'default' | 'error'
}) {
  const toneCls =
    tone === 'error'
      ? 'bg-red-50 border-red-200 text-red-700'
      : 'bg-gray-50 border-gray-200 text-gray-600'
  return (
    <div>
      <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5 px-1">
        {label}
      </div>
      <pre className={`text-[10px] font-mono p-2 rounded border ${toneCls} max-h-32 overflow-auto whitespace-pre-wrap break-words`}>
        {children}
      </pre>
    </div>
  )
}

function prettyJSON(value: unknown): string {
  try {
    if (typeof value === 'string') return value
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

interface RunRowProps {
  run: Run
}

export function RunRow({ run }: RunRowProps) {
  const [expanded, setExpanded] = useState(false)
  const duration = fmtDuration(run.startedAt, run.finishedAt, run.status === 'RUNNING' ? 'Running…' : '—')
  const succeeded = run.nodeRuns?.filter((nr) => nr.status === 'SUCCESS').length ?? 0
  const total = run.nodeRuns?.length ?? 0

  return (
    <div className="border-b border-gray-100">
      <button
        className="w-full flex items-center gap-2 p-2.5 hover:bg-gray-50 transition-colors text-left"
        onClick={() => setExpanded((p) => !p)}
      >
        {expanded
          ? <ChevronDown size={13} className="text-gray-400" />
          : <ChevronRight size={13} className="text-gray-400" />
        }
        <StatusIcon status={run.status} />
        <span className="text-xs text-gray-600 flex-1 truncate font-mono">{run.id.slice(-8)}</span>
        <span className="text-xs text-gray-400">{duration}</span>
        <StatusBadge status={run.status} />
      </button>

      <div className="px-2 pb-2 flex items-center justify-between text-[10px] text-gray-400">
        <span>{formatDistanceToNow(run.startedAt)} · {run.scope}</span>
        {total > 0 && <span>{succeeded}/{total} nodes</span>}
      </div>

      {expanded && run.nodeRuns && run.nodeRuns.length > 0 && (
        <div className="bg-gray-50/50 border-t border-gray-100">
          {run.nodeRuns.map((nr) => (
            <NodeRunRow key={nr.id} nr={nr} />
          ))}
        </div>
      )}
    </div>
  )
}
