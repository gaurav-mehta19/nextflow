'use client'

import { useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ReactFlowProvider } from '@xyflow/react'
import { WorkflowCanvas } from '../../../../../components/canvas/WorkflowCanvas'
import { HistoryPanel } from '../../../../../components/history/HistoryPanel'
import { Button } from '../../../../../components/ui/Button'
import { useCanvasStore } from '../../../../../lib/store/canvas.store'
import { useRunStore } from '../../../../../lib/store/run.store'
import { buildSampleWorkflow } from '../../../../../lib/sample-workflow'
import { UserButton } from '@clerk/nextjs'
import { ArrowLeft, Play, History, Workflow, ChevronLeft, ChevronRight, Check } from 'lucide-react'
import { useState } from 'react'
import type { NodeData } from '../../../../../lib/types/nodes'

interface WorkflowResponse {
  workflow: {
    id: string
    name: string
    nodes: unknown[]
    edges: unknown[]
  }
}

export default function CanvasPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const workflowId = params.id

  const { setNodes, setEdges, loadWorkflow, setWorkflowId, setWorkflowName, nodes, edges, workflowName, reset: resetCanvas } =
    useCanvasStore()
  const { setActiveRun, setRunStatus, resetRun, runStatus } = useRunStore()

  const [historyOpen, setHistoryOpen] = useState(true)
  const [running, setRunning] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const nameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    return () => { resetCanvas() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const load = async () => {
      const res = await fetch(`/api/workflows/${workflowId}`)
      if (!res.ok) { router.push('/dashboard'); return }

      const data = await res.json() as WorkflowResponse
      const wf = data.workflow
      setWorkflowId(wf.id)
      setWorkflowName(wf.name)

      if (wf.nodes.length === 0) {
        const { nodes: starterNodes, edges: starterEdges } = buildSampleWorkflow()
        loadWorkflow(starterNodes, starterEdges)
        void fetch(`/api/workflows/${workflowId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nodes: starterNodes, edges: starterEdges }),
        })
      } else {
        loadWorkflow(
          wf.nodes as Parameters<typeof setNodes>[0],
          wf.edges as Parameters<typeof setEdges>[0]
        )
      }
    }
    void load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflowId])

  useEffect(() => {
    if (runStatus === 'success') {
      setToast('Workflow completed successfully!')
      setRunning(false)
      setTimeout(() => setToast(null), 4000)
    } else if (runStatus === 'failed') {
      setToast('Workflow failed. Check history for details.')
      setRunning(false)
      setTimeout(() => setToast(null), 4000)
    }
  }, [runStatus])

  const handleNameSave = useCallback(async () => {
    const trimmed = nameInput.trim()
    if (!trimmed || trimmed === workflowName) { setEditingName(false); return }
    setWorkflowName(trimmed)
    setEditingName(false)
    await fetch(`/api/workflows/${workflowId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmed }),
    })
  }, [nameInput, workflowName, workflowId, setWorkflowName])

  const selectedCount = nodes.filter((n) => n.selected).length

  const handleRun = useCallback(async (mode: 'full' | 'selected' = 'full') => {
    setRunning(true)
    resetRun()

    const requestInputsNode = nodes.find((n) => n.type === 'requestInputs')
    const fields = (requestInputsNode?.data as NodeData & { fields?: Array<{ id: string; value?: string }> })?.fields ?? []
    const collectedValues: Record<string, unknown> = {}
    for (const field of fields) {
      collectedValues[field.id] = field.value ?? ''
    }

    let runNodes = nodes
    let runEdges = edges
    let scope: 'full' | 'partial' | 'single' = 'full'

    if (mode === 'selected') {
      const seedIds = nodes.filter((n) => n.selected).map((n) => n.id)
      if (seedIds.length === 0) {
        setRunning(false)
        return
      }
      // Walk upstream to include all ancestors so dependencies resolve
      const included = new Set<string>(seedIds)
      let changed = true
      while (changed) {
        changed = false
        for (const e of edges) {
          if (included.has(e.target) && !included.has(e.source)) {
            included.add(e.source)
            changed = true
          }
        }
      }
      runNodes = nodes.filter((n) => included.has(n.id))
      runEdges = edges.filter((e) => included.has(e.source) && included.has(e.target))
      scope = seedIds.length === 1 ? 'single' : 'partial'
    }

    try {
      const res = await fetch(`/api/workflows/${workflowId}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope, inputValues: collectedValues, nodes: runNodes, edges: runEdges }),
      })

      if (!res.ok) {
        setToast('Failed to start run')
        setRunning(false)
        return
      }

      const data = await res.json() as { runId: string }
      setActiveRun(data.runId)
      setRunStatus('running')
    } catch {
      setToast('Failed to start run')
      setRunning(false)
    }
  }, [workflowId, nodes, edges, resetRun, setActiveRun, setRunStatus])

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-200 bg-white z-20 flex-shrink-0">
        <button
          onClick={() => router.push('/dashboard')}
          className="text-gray-400 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>

        <div className="flex items-center gap-2">
          <Workflow size={16} className="text-indigo-500" />
          {editingName ? (
            <div className="flex items-center gap-1">
              <input
                ref={nameInputRef}
                className="text-sm font-semibold text-gray-800 bg-gray-50 border border-indigo-400 rounded px-2 py-0.5 outline-none"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleNameSave()
                  if (e.key === 'Escape') setEditingName(false)
                }}
                autoFocus
              />
              <button onClick={() => { void handleNameSave() }} className="text-green-500 hover:text-green-600">
                <Check size={14} />
              </button>
            </div>
          ) : (
            <span
              className="text-sm font-semibold text-gray-800 cursor-pointer hover:text-indigo-600 transition-colors"
              onDoubleClick={() => { setNameInput(workflowName); setEditingName(true) }}
              title="Double-click to rename"
            >
              {workflowName}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {selectedCount > 0 && (
            <Button
              variant="secondary"
              size="sm"
              loading={running}
              onClick={() => { void handleRun('selected') }}
              disabled={running}
              title="Run selected node(s) and their dependencies"
            >
              <Play size={14} />
              Run selected ({selectedCount})
            </Button>
          )}
          <Button
            variant="primary"
            size="sm"
            loading={running}
            onClick={() => { void handleRun('full') }}
            disabled={running}
          >
            <Play size={14} />
            {running ? 'Running…' : 'Run'}
          </Button>

          <button
            onClick={() => setHistoryOpen((p) => !p)}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 transition-colors border border-gray-200 hover:border-gray-300 rounded-lg px-2.5 py-1.5"
          >
            <History size={14} />
            History
            {historyOpen ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
          </button>

          <UserButton afterSignOutUrl="/sign-in" />
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 relative">
          <ReactFlowProvider>
            <WorkflowCanvas workflowId={workflowId} />
          </ReactFlowProvider>
        </div>

        {historyOpen && (
          <div className="w-72 border-l border-gray-200 bg-white flex flex-col overflow-hidden flex-shrink-0">
            <HistoryPanel workflowId={workflowId} />
          </div>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-white border border-gray-200 text-sm text-gray-700 px-4 py-2.5 rounded-xl shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  )
}
