'use client'

import { useEffect, useCallback, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ReactFlowProvider } from '@xyflow/react'
import { WorkflowCanvas } from '../../../../../components/canvas/WorkflowCanvas'
import { HistoryPanel } from '../../../../../components/history/HistoryPanel'
import { RealtimeRunListener } from '../../../../../components/realtime/RealtimeRunListener'
import { Button } from '../../../../../components/ui/Button'
import { useCanvasStore } from '../../../../../lib/store/canvas.store'
import { useRunStore } from '../../../../../lib/store/run.store'
import { useRunWorkflow, type RunMode } from '../../../../../lib/hooks/useRunWorkflow'
import { buildSampleWorkflow } from '../../../../../lib/sample-workflow'
import { ArrowLeft, Play, History, Workflow, ChevronLeft, ChevronRight, Check } from 'lucide-react'

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
  const { resetRun, runStatus, activeRunId } = useRunStore()
  const { run } = useRunWorkflow({ workflowId, nodes, edges })

  const [historyOpen, setHistoryOpen] = useState(true)
  const [running, setRunning] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const nameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    return () => {
      resetCanvas()
      resetRun()
    }

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

  }, [workflowId])

  useEffect(() => {
    if (runStatus === 'running') {
      setRunning(true)
      return
    }
    if (runStatus !== 'success' && runStatus !== 'failed') return

    setRunning(false)
    setToast(
      runStatus === 'success'
        ? 'Workflow completed successfully!'
        : 'Workflow failed. Check history for details.',
    )
    const toastTimer = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(toastTimer)
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

  const handleRun = useCallback(async (mode: RunMode = 'full') => {
    setRunning(true)
    const result = await run(mode)
    if (result === 'no-selection') {
      setRunning(false)
    } else if (result === 'error') {
      setToast('Failed to start run')
      setRunning(false)
    }
  }, [run])

  return (
    <div className="h-screen flex flex-col bg-white">
      <header className="flex items-center gap-3 px-5 h-14 border-b border-gray-100 bg-white/95 backdrop-blur-md z-20 flex-shrink-0">
        <button
          onClick={() => router.push('/dashboard')}
          className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          title="Back to dashboard"
        >
          <ArrowLeft size={17} />
        </button>

        <div className="w-px h-5 bg-gray-200" />

        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
            <Workflow size={13} className="text-white" />
          </div>
          {editingName ? (
            <div className="flex items-center gap-1">
              <input
                ref={nameInputRef}
                className="text-sm font-semibold text-gray-900 bg-gray-50 border border-indigo-400 rounded-md px-2 py-0.5 outline-none focus:bg-white"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleNameSave()
                  if (e.key === 'Escape') setEditingName(false)
                }}
                autoFocus
              />
              <button onClick={() => { void handleNameSave() }} className="w-6 h-6 flex items-center justify-center text-green-600 hover:bg-green-50 rounded">
                <Check size={14} />
              </button>
            </div>
          ) : (
            <span
              className="text-sm font-semibold text-gray-900 cursor-pointer hover:text-indigo-600 transition-colors px-1.5 py-0.5 rounded hover:bg-gray-50"
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
              <Play size={13} />
              Run selected ({selectedCount})
            </Button>
          )}
          <Button
            variant="primary"
            size="sm"
            loading={running}
            onClick={() => { void handleRun('full') }}
            disabled={running}
            className="!bg-indigo-600 hover:!bg-indigo-500 shadow-[0_2px_8px_rgba(79,70,229,0.25)]"
          >
            <Play size={13} strokeWidth={2.5} />
            {running ? 'Running…' : 'Run'}
          </Button>

          <button
            onClick={() => setHistoryOpen((p) => !p)}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg px-2.5 h-8 transition-colors"
            title={historyOpen ? 'Hide history' : 'Show history'}
          >
            <History size={14} />
            History
            {historyOpen ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
          </button>
        </div>
      </header>

      {activeRunId && (
        <RealtimeRunListener workflowId={workflowId} dbRunId={activeRunId} />
      )}

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 relative">
          <ReactFlowProvider>
            <WorkflowCanvas workflowId={workflowId} />
          </ReactFlowProvider>
        </div>

        {historyOpen && (
          <div className="w-80 border-l border-gray-100 bg-white flex flex-col overflow-hidden flex-shrink-0">
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
