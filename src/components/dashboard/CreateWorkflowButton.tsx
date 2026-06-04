'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Sparkles } from 'lucide-react'
import { Button } from '../ui/Button'
import { buildBlankWorkflow } from '../../lib/sample-workflow'

type Variant = 'sample' | 'blank'

interface Props {
  variant?: Variant
}

const COPY: Record<Variant, { label: string; workflowName: string }> = {
  sample: { label: 'Sample Workflow', workflowName: 'Sample Workflow' },
  blank:  { label: 'New Workflow',    workflowName: 'New Workflow'    },
}

export function CreateWorkflowButton({ variant = 'sample' }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const { label, workflowName } = COPY[variant]

  const create = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: workflowName }),
      })
      if (!res.ok) throw new Error('Failed to create workflow')
      const { workflow } = await res.json() as { workflow: { id: string } }

      // For the blank starter, pre-seed the workflow with just Request-Inputs +
      // Response before navigating. That way the canvas page sees a non-empty
      // workflow and skips the sample-auto-populate branch.
      if (variant === 'blank') {
        const { nodes, edges } = buildBlankWorkflow()
        const patch = await fetch(`/api/workflows/${workflow.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nodes, edges }),
        })
        if (!patch.ok) throw new Error('Failed to seed starter nodes')
      }

      router.push(`/workflows/${workflow.id}/canvas`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        onClick={() => { void create() }}
        loading={loading}
        size="md"
        variant={variant === 'blank' ? 'primary' : 'secondary'}
      >
        {variant === 'blank' ? <Plus size={16} /> : <Sparkles size={16} />}
        {label}
      </Button>
      {error && <p className="text-[11px] text-red-500" role="alert">{error}</p>}
    </div>
  )
}
