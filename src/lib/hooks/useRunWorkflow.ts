'use client'

import { useCallback } from 'react'
import type { Edge, Node } from '@xyflow/react'
import { useRunStore } from '../store/run.store'
import { NodeKind, type NodeData } from '../types/nodes'

export type RunMode = 'full' | 'selected'

interface UseRunWorkflowArgs {
  workflowId: string
  nodes: Node<NodeData>[]
  edges: Edge[]
}

export type RunResult = 'started' | 'no-selection' | 'error'

interface UseRunWorkflow {
  run: (mode?: RunMode) => Promise<RunResult>
}

interface RequestInputsFields {
  fields?: Array<{ id: string; value?: string }>
}

function collectInputValues(nodes: Node<NodeData>[]): Record<string, unknown> {
  const requestInputsNode = nodes.find((n) => n.type === 'requestInputs')
  const fields = (requestInputsNode?.data as NodeData & RequestInputsFields)?.fields ?? []
  const out: Record<string, unknown> = {}
  for (const field of fields) out[field.id] = field.value ?? ''
  return out
}

function expandSelection(
  nodes: Node<NodeData>[],
  edges: Edge[],
  executableNodes: Node<NodeData>[],
): { runNodes: Node<NodeData>[]; runEdges: Edge[]; scope: 'partial' | 'single' } | null {
  const seedIds = nodes.filter((n) => n.selected).map((n) => n.id)
  if (seedIds.length === 0) return null

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
  return {
    runNodes: executableNodes.filter((n) => included.has(n.id)),
    runEdges: edges.filter((e) => included.has(e.source) && included.has(e.target)),
    scope: seedIds.length === 1 ? 'single' : 'partial',
  }
}

export function useRunWorkflow({ workflowId, nodes, edges }: UseRunWorkflowArgs): UseRunWorkflow {
  const resetRun = useRunStore((s) => s.resetRun)
  const setActiveRun = useRunStore((s) => s.setActiveRun)
  const setRunStatus = useRunStore((s) => s.setRunStatus)

  const run = useCallback(async (mode: RunMode = 'full'): Promise<RunResult> => {
    resetRun()

    const inputValues = collectInputValues(nodes)
    const executableNodes = nodes.filter(
      (n) => (n.data as NodeData)?.kind !== NodeKind.STICKY_NOTE,
    )

    let runNodes: Node<NodeData>[] = executableNodes
    let runEdges: Edge[] = edges
    let scope: 'full' | 'partial' | 'single' = 'full'

    if (mode === 'selected') {
      const selection = expandSelection(nodes, edges, executableNodes)
      if (!selection) return 'no-selection'
      runNodes = selection.runNodes
      runEdges = selection.runEdges
      scope = selection.scope
    }

    try {
      const res = await fetch(`/api/workflows/${workflowId}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope, inputValues, nodes: runNodes, edges: runEdges }),
      })
      if (!res.ok) return 'error'
      const data = await res.json() as { runId: string }
      setActiveRun(data.runId)
      setRunStatus('running')
      return 'started'
    } catch {
      return 'error'
    }
  }, [workflowId, nodes, edges, resetRun, setActiveRun, setRunStatus])

  return { run }
}
