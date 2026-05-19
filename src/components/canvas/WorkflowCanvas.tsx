'use client'

import { useCallback, useEffect, useRef } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  SelectionMode,
  type Connection,
  type Edge,
  type Node,
  type OnNodesChange,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { nodeTypes } from './nodes'
import { AnimatedEdge } from './edges/AnimatedEdge'
import { MiniMapPanel } from './MiniMapPanel'
import { CanvasToolbar } from './CanvasToolbar'
import { useCanvasStore } from '../../lib/store/canvas.store'
import { hasCycle } from '../../lib/dag/topological-sort'
import { HandleType } from '../../lib/types/handles'
import type { NodeData } from '../../lib/types/nodes'
import { NodeKind } from '../../lib/types/nodes'

const edgeTypes = {
  animatedEdge: AnimatedEdge,
}

interface WorkflowCanvasProps {
  workflowId: string
}

function inferHandleType(handleId: string | null | undefined): HandleType {
  if (!handleId) return HandleType.TEXT
  if (handleId.includes('image')) return HandleType.IMAGE
  if (handleId.includes('video')) return HandleType.VIDEO
  if (handleId.includes('audio')) return HandleType.AUDIO
  if (handleId.includes('file')) return HandleType.FILE
  return HandleType.TEXT
}

export function WorkflowCanvas({ workflowId }: WorkflowCanvasProps) {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
  } = useCanvasStore()

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const setIsSaving = useCanvasStore((s) => s.setIsSaving)

  const saveWorkflow = useCallback(async () => {
    setIsSaving(true)
    try {
      await fetch(`/api/workflows/${workflowId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes, edges }),
      })
    } finally {
      setIsSaving(false)
    }
  }, [workflowId, nodes, edges, setIsSaving])

  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => { void saveWorkflow() }, 1500)
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current) }
  }, [nodes, edges, saveWorkflow])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey
      if (meta && !e.shiftKey && e.key === 'z') {
        e.preventDefault()
        useCanvasStore.getState().undo()
      }
      if (meta && e.shiftKey && e.key === 'z') {
        e.preventDefault()
        useCanvasStore.getState().redo()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const onBeforeDelete = useCallback(
    ({ nodes: toDelete, edges: toDeleteEdges }: { nodes: Node[]; edges: Edge[] }): Promise<boolean | { nodes: Node[]; edges: Edge[] }> => {
      const protectedTypes: string[] = [NodeKind.REQUEST_INPUTS, NodeKind.RESPONSE]
      const safeToDelete = toDelete.filter(
        (n) => !protectedTypes.includes((n.data as NodeData).kind as string)
      )
      if (safeToDelete.length === 0 && toDeleteEdges.length === 0) return Promise.resolve(false)

      const safeIds = new Set(safeToDelete.map((n) => n.id))
      const safeEdges = toDeleteEdges.filter((e) => {
        const srcWasToDelete = toDelete.some((n) => n.id === e.source)
        const tgtWasToDelete = toDelete.some((n) => n.id === e.target)
        if (srcWasToDelete && !safeIds.has(e.source)) return false
        if (tgtWasToDelete && !safeIds.has(e.target)) return false
        return true
      })

      return Promise.resolve({ nodes: safeToDelete, edges: safeEdges })
    },
    []
  )

  const isValidConnection = useCallback(
    (connection: Edge | Connection): boolean => {
      const sourceHandle = 'sourceHandle' in connection ? connection.sourceHandle : null
      const targetHandle = 'targetHandle' in connection ? connection.targetHandle : null
      const source = connection.source ?? ''
      const target = connection.target ?? ''

      const sourceType = inferHandleType(sourceHandle as string | null | undefined)
      const targetType = inferHandleType(targetHandle as string | null | undefined)

      if (sourceType !== targetType) return false

      const hypotheticalEdges = [
        ...edges,
        { id: 'test', source, target },
      ]
      const graphNodes = nodes.map((n) => ({ id: n.id }))
      const graphEdges = hypotheticalEdges.map((e) => ({
        source: e.source,
        target: e.target,
      }))

      if (hasCycle(graphNodes, graphEdges)) return false
      return true
    },
    [nodes, edges]
  )

  return (
    <div className="w-full h-full relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange as OnNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        isValidConnection={isValidConnection}
        onBeforeDelete={onBeforeDelete}
        selectionMode={SelectionMode.Partial}
        defaultEdgeOptions={{ type: 'animatedEdge' }}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.1}
        maxZoom={2}
        className="bg-[#fafafa]"
        deleteKeyCode={['Delete', 'Backspace']}
        multiSelectionKeyCode="Shift"
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          color="#e4e4e7"
          gap={24}
          size={1.2}
        />
        <Controls className="!bg-white !border-gray-200 !rounded-lg !shadow-sm" showInteractive={false} />
        <MiniMapPanel />
        <CanvasToolbar onSave={saveWorkflow} />
      </ReactFlow>
    </div>
  )
}
