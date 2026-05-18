'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { Button } from '../ui/Button'

export function CreateWorkflowButton() {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const create = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New Workflow' }),
      })
      if (!res.ok) throw new Error('Failed to create')
      const data = await res.json() as { workflow: { id: string } }
      router.push(`/workflows/${data.workflow.id}/canvas`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button onClick={() => { void create() }} loading={loading} size="md">
      <Plus size={16} />
      New Workflow
    </Button>
  )
}
