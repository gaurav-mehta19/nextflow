import type { Edge, Node } from '@xyflow/react'
import { NodeKind, type NodeData } from '../types/nodes'
import { topologicalSort } from './topological-sort'

const COLUMN_GAP = 80
const ROW_GAP = 60
const DEFAULT_WIDTH = 340
const DEFAULT_HEIGHT = 320

function getDims<T extends Record<string, unknown>>(node: Node<T>): { w: number; h: number } {
  const measured = (node as Node<T> & { measured?: { width?: number; height?: number } }).measured
  return {
    w: measured?.width ?? node.width ?? DEFAULT_WIDTH,
    h: measured?.height ?? node.height ?? DEFAULT_HEIGHT,
  }
}

function isLayoutable(node: Node<NodeData>): boolean {
  // Sticky notes are decorative and don't participate in the DAG — keep them
  // where the user dropped them rather than dragging them into a column.
  return node.data?.kind !== NodeKind.STICKY_NOTE
}

/**
 * Lay DAG nodes out left-to-right by topological level. Within each column,
 * nodes are stacked vertically and the column is centered around y=0 so the
 * whole graph reads as a horizontal flow. Non-DAG nodes (sticky notes) keep
 * their original positions.
 */
export function autoArrange(
  nodes: Node<NodeData>[],
  edges: Edge[],
): Node<NodeData>[] {
  if (nodes.length === 0) return nodes

  const layoutable = nodes.filter(isLayoutable)
  if (layoutable.length === 0) return nodes

  const graphNodes = layoutable.map((n) => ({ id: n.id }))
  const layoutableIds = new Set(layoutable.map((n) => n.id))
  const graphEdges = edges
    .filter((e) => layoutableIds.has(e.source) && layoutableIds.has(e.target))
    .map((e) => ({ source: e.source, target: e.target }))
  const levels = topologicalSort(graphNodes, graphEdges)

  const byId = new Map(layoutable.map((n) => [n.id, n]))
  const newPositions = new Map<string, { x: number; y: number }>()

  let columnX = 0
  for (const level of levels) {
    const nodesInLevel = level
      .map((id) => byId.get(id))
      .filter((n): n is Node<NodeData> => n !== undefined)

    const dims = nodesInLevel.map(getDims)
    const colWidth = Math.max(DEFAULT_WIDTH, ...dims.map((d) => d.w))
    const totalHeight =
      dims.reduce((sum, d) => sum + d.h, 0) + ROW_GAP * Math.max(0, dims.length - 1)
    const startY = -totalHeight / 2

    let rowY = startY
    nodesInLevel.forEach((node, i) => {
      const { h, w } = dims[i]
      newPositions.set(node.id, {
        x: columnX + (colWidth - w) / 2,
        y: rowY,
      })
      rowY += h + ROW_GAP
    })

    columnX += colWidth + COLUMN_GAP
  }

  return nodes.map((n) => {
    const pos = newPositions.get(n.id)
    return pos ? { ...n, position: pos } : n
  })
}
