export interface GraphNode {
  id: string
}

export interface GraphEdge {
  source: string
  target: string
}

export type ExecutionLevel = string[]

export function topologicalSort(nodes: GraphNode[], edges: GraphEdge[]): ExecutionLevel[] {
  const inDegree = new Map<string, number>()
  const adjacency = new Map<string, string[]>()

  for (const node of nodes) {
    inDegree.set(node.id, 0)
    adjacency.set(node.id, [])
  }

  for (const edge of edges) {
    const targets = adjacency.get(edge.source) ?? []
    targets.push(edge.target)
    adjacency.set(edge.source, targets)
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1)
  }

  const levels: ExecutionLevel[] = []
  let current = nodes.filter((n) => (inDegree.get(n.id) ?? 0) === 0).map((n) => n.id)

  while (current.length > 0) {
    levels.push(current)
    const next: string[] = []
    for (const nodeId of current) {
      for (const neighbor of adjacency.get(nodeId) ?? []) {
        const deg = (inDegree.get(neighbor) ?? 1) - 1
        inDegree.set(neighbor, deg)
        if (deg === 0) next.push(neighbor)
      }
    }
    current = next
  }

  return levels
}

export function hasCycle(nodes: GraphNode[], edges: GraphEdge[]): boolean {
  const visited = new Set<string>()
  const inStack = new Set<string>()
  const adjacency = new Map<string, string[]>()

  for (const node of nodes) {
    adjacency.set(node.id, [])
  }
  for (const edge of edges) {
    adjacency.get(edge.source)?.push(edge.target)
  }

  function dfs(nodeId: string): boolean {
    visited.add(nodeId)
    inStack.add(nodeId)
    for (const neighbor of adjacency.get(nodeId) ?? []) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor)) return true
      } else if (inStack.has(neighbor)) {
        return true
      }
    }
    inStack.delete(nodeId)
    return false
  }

  for (const node of nodes) {
    if (!visited.has(node.id)) {
      if (dfs(node.id)) return true
    }
  }

  return false
}
