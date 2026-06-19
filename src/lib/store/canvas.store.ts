import { create } from 'zustand'
import {
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
  type Connection,
} from '@xyflow/react'
import type { NodeData } from '../types/nodes'

type FlowNode = Node<NodeData>

interface HistoryEntry {
  nodes: FlowNode[]
  edges: Edge[]
}

const MAX_HISTORY = 50

interface CanvasState {
  nodes: FlowNode[]
  edges: Edge[]
  history: HistoryEntry[]
  historyIndex: number
  workflowId: string | null
  workflowName: string
  isSaving: boolean
  loaded: boolean
  selectMode: boolean
  setWorkflowId: (id: string) => void
  setWorkflowName: (name: string) => void
  setNodes: (nodes: FlowNode[]) => void
  setEdges: (edges: Edge[]) => void
  loadWorkflow: (nodes: FlowNode[], edges: Edge[]) => void
  onNodesChange: (changes: NodeChange<FlowNode>[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void
  onConnect: (connection: Connection) => void
  addNode: (node: FlowNode) => void
  updateNodeData: (nodeId: string, data: Partial<NodeData>) => void
  undo: () => void
  redo: () => void
  pushHistory: () => void
  setIsSaving: (saving: boolean) => void
  toggleSelectMode: () => void
  setSelectMode: (on: boolean) => void
  reset: () => void
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  nodes: [],
  edges: [],
  history: [],
  historyIndex: -1,
  workflowId: null,
  workflowName: 'New Workflow',
  isSaving: false,
  loaded: false,
  selectMode: false,

  setWorkflowId: (id) => set({ workflowId: id }),
  setWorkflowName: (name) => set({ workflowName: name }),
  setIsSaving: (saving) => set({ isSaving: saving }),
  toggleSelectMode: () => set((s) => ({ selectMode: !s.selectMode })),
  setSelectMode: (on) => set({ selectMode: on }),

  setNodes: (nodes) => set({ nodes }),

  setEdges: (edges) => set({ edges: edges.map((e) => ({ ...e, animated: false })) }),

  loadWorkflow: (nodes, edges) => {
    const cleanEdges = edges.map((e) => ({ ...e, animated: false }))
    set({
      nodes,
      edges: cleanEdges,
      history: [{ nodes: nodes.map((n) => ({ ...n })), edges: cleanEdges.map((e) => ({ ...e })) }],
      historyIndex: 0,
      loaded: true,
    })
  },

  onNodesChange: (changes) => {
    const next = applyNodeChanges(changes, get().nodes)
    set({ nodes: next })

    const significant = changes.some(
      (c) =>
        c.type === 'remove' ||
        c.type === 'add' ||
        (c.type === 'position' && c.dragging === false)
    )
    if (significant) get().pushHistory()
  },

  onEdgesChange: (changes) => {
    const next = applyEdgeChanges(changes, get().edges)
    set({ edges: next })

    const significant = changes.some((c) => c.type === 'remove' || c.type === 'add')
    if (significant) get().pushHistory()
  },

  onConnect: (connection) => {
    const next = addEdge({ ...connection, type: 'animatedEdge' }, get().edges)
    set({ edges: next })
    get().pushHistory()
  },

  addNode: (node) => {
    set({ nodes: [...get().nodes, node] })
    get().pushHistory()
  },

  updateNodeData: (nodeId, data) => {
    set({
      nodes: get().nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...data } as NodeData } : n
      ),
    })
    get().pushHistory()
  },

  pushHistory: () => {
    const { nodes, edges, history, historyIndex } = get()
    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push({
      nodes: nodes.map((n) => ({ ...n })),
      edges: edges.map((e) => ({ ...e })),
    })
    while (newHistory.length > MAX_HISTORY) newHistory.shift()
    set({ history: newHistory, historyIndex: newHistory.length - 1 })
  },

  undo: () => {
    const { historyIndex, history } = get()
    if (historyIndex <= 0) return
    const prev = history[historyIndex - 1]
    set({
      nodes: prev.nodes.map((n) => ({ ...n })),
      edges: prev.edges.map((e) => ({ ...e })),
      historyIndex: historyIndex - 1,
    })
  },

  redo: () => {
    const { historyIndex, history } = get()
    if (historyIndex >= history.length - 1) return
    const next = history[historyIndex + 1]
    set({
      nodes: next.nodes.map((n) => ({ ...n })),
      edges: next.edges.map((e) => ({ ...e })),
      historyIndex: historyIndex + 1,
    })
  },

  reset: () =>
    set({
      nodes: [],
      edges: [],
      history: [],
      historyIndex: -1,
      workflowId: null,
      workflowName: 'New Workflow',
      isSaving: false,
      loaded: false,
    }),
}))
