'use client'

import { useEffect, useRef, useState } from 'react'
import { WorkflowCard } from '../../../components/dashboard/WorkflowCard'
import { CreateWorkflowButton } from '../../../components/dashboard/CreateWorkflowButton'
import { Modal } from '../../../components/ui/Modal'
import { Button } from '../../../components/ui/Button'
import { Workflow, Upload, AlertTriangle } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface PreviewNode {
  id: string
  type?: string
  position: { x: number; y: number }
}

interface PreviewEdge {
  source: string
  target: string
}

interface WorkflowSummary {
  id: string
  name: string
  updatedAt: string
  nodes?: PreviewNode[]
  edges?: PreviewEdge[]
  runs?: Array<{ status: string }>
}

export default function DashboardPage() {
  const router = useRouter()
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const importInputRef = useRef<HTMLInputElement>(null)

  const fetchWorkflows = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/workflows')
      if (res.ok) {
        const data = await res.json() as { workflows: WorkflowSummary[] }
        setWorkflows(data.workflows)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchWorkflows()
  }, [])

  const handleImport = async (file: File) => {
    try {
      const text = await file.text()
      const json = JSON.parse(text) as unknown
      const res = await fetch('/api/workflows/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(json),
      })
      if (res.ok) {
        const data = await res.json() as { workflow: { id: string } }
        router.push(`/workflows/${data.workflow.id}/canvas`)
      }
    } catch {
      // invalid file — ignore silently
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await fetch(`/api/workflows/${deleteTarget.id}`, { method: 'DELETE' })
      setWorkflows((prev) => prev.filter((w) => w.id !== deleteTarget.id))
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  const handleRename = async (id: string, name: string) => {
    await fetch(`/api/workflows/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    setWorkflows((prev) => prev.map((w) => (w.id === id ? { ...w, name } : w)))
  }

  return (
    <>
      <main className="flex-1 max-w-6xl mx-auto px-6 py-8 w-full">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Workflows</h1>
            <p className="text-gray-500 text-sm mt-1">Build and run LLM-powered workflows</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={importInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void handleImport(file)
                e.target.value = ''
              }}
            />
            <button
              onClick={() => importInputRef.current?.click()}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 border border-gray-200 hover:border-gray-300 rounded-lg px-3 py-2 transition-colors bg-white"
            >
              <Upload size={14} /> Import
            </button>
            <CreateWorkflowButton variant="sample" />
            <CreateWorkflowButton variant="blank" />
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-2xl overflow-hidden animate-pulse">
                <div className="h-44 bg-gray-100" />
                <div className="p-4 space-y-3">
                  <div className="h-4 bg-gray-100 rounded w-3/4" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                  <div className="h-9 bg-gray-100 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        ) : workflows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white border border-gray-200 flex items-center justify-center mb-4 shadow-sm">
              <Workflow size={28} className="text-gray-300" />
            </div>
            <h2 className="text-lg font-semibold text-gray-500 mb-2">No workflows yet</h2>
            <p className="text-gray-400 text-sm mb-6 max-w-xs">
              Create your first workflow to start building LLM-powered automations
            </p>
            <div className="flex items-center gap-2">
              <CreateWorkflowButton variant="sample" />
              <CreateWorkflowButton variant="blank" />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {workflows.map((w) => (
              <WorkflowCard
                key={w.id}
                id={w.id}
                name={w.name}
                updatedAt={w.updatedAt}
                lastRunStatus={w.runs?.[0]?.status ?? null}
                nodes={w.nodes ?? []}
                edges={w.edges ?? []}
                onDeleteRequest={(id, name) => setDeleteTarget({ id, name })}
                onRename={(id, name) => { void handleRename(id, name) }}
              />
            ))}
          </div>
        )}
      </main>

      <Modal
        open={deleteTarget !== null}
        onClose={() => { if (!deleting) setDeleteTarget(null) }}
        title="Delete workflow"
      >
        <div className="flex items-start gap-3 mb-5">
          <div className="w-10 h-10 rounded-full bg-red-50 border border-red-100 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={18} className="text-red-500" />
          </div>
          <div className="text-sm text-gray-600">
            Are you sure you want to delete <span className="font-semibold text-gray-900">&ldquo;{deleteTarget?.name}&rdquo;</span>?
            This will permanently remove the workflow and all its run history. This action cannot be undone.
          </div>
        </div>
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={() => setDeleteTarget(null)} disabled={deleting}>
            Cancel
          </Button>
          <Button variant="danger" size="sm" onClick={() => { void confirmDelete() }} loading={deleting}>
            Delete
          </Button>
        </div>
      </Modal>
    </>
  )
}
