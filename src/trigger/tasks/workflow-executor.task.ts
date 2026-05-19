import { task } from '@trigger.dev/sdk'
import type { Edge } from '@xyflow/react'
import { prisma } from '../../lib/db/client'
import { topologicalSort } from '../../lib/dag/topological-sort'
import { NodeKind } from '../../lib/types/nodes'
import type { NodeData, RequestInputsData } from '../../lib/types/nodes'
import type { Node } from '@xyflow/react'
import { cropImageTask } from './crop-image.task'
import { geminiTask } from './gemini.task'
import type { Prisma } from '@/generated/prisma/client'

interface ExecutorPayload {
  runId: string
  workflowId: string
  nodes: Node<NodeData>[]
  edges: Edge[]
  inputValues: Record<string, unknown>
}

interface CropBatchItem {
  nodeId: string
  payload: {
    imageUrl: string
    xPct: number
    yPct: number
    wPct: number
    hPct: number
    nodeRunId: string
  }
}

interface GeminiBatchItem {
  nodeId: string
  payload: {
    prompt: string
    systemPrompt?: string
    imageUrls?: string[]
    model: string
    nodeRunId: string
  }
}

function resolveInputs(
  nodeId: string,
  incomingEdges: Map<string, Edge[]>,
  nodeOutputs: Map<string, Record<string, unknown>>
): Record<string, unknown> {
  const incoming = incomingEdges.get(nodeId) ?? []
  const resolvedInputs: Record<string, unknown> = {}
  for (const edge of incoming) {
    const sourceOutputs = nodeOutputs.get(edge.source) ?? {}
    const srcHandle = edge.sourceHandle ?? 'output'
    const tgtHandle = edge.targetHandle ?? 'input'
    const existing = resolvedInputs[tgtHandle]
    if (existing !== undefined) {
      resolvedInputs[tgtHandle] = Array.isArray(existing)
        ? [...existing, sourceOutputs[srcHandle]]
        : [existing, sourceOutputs[srcHandle]]
    } else {
      resolvedInputs[tgtHandle] = sourceOutputs[srcHandle]
    }
  }
  return resolvedInputs
}

export const workflowExecutorTask = task({
  id: 'workflow-executor',
  maxDuration: 600,
  run: async (payload: ExecutorPayload): Promise<void> => {
    const { runId, nodes, edges, inputValues } = payload

    const graphNodes = nodes.map((n) => ({ id: n.id }))
    const graphEdges = edges.map((e) => ({ source: e.source, target: e.target }))
    const levels = topologicalSort(graphNodes, graphEdges)

    const nodeOutputs = new Map<string, Record<string, unknown>>()
    const incomingEdges = new Map<string, Edge[]>()
    for (const edge of edges) {
      if (!incomingEdges.has(edge.target)) incomingEdges.set(edge.target, [])
      incomingEdges.get(edge.target)!.push(edge)
    }

    // Pre-seed Request-Inputs outputs from the inputValues payload
    for (const node of nodes) {
      if (node.data.kind === NodeKind.REQUEST_INPUTS) {
        const outputs: Record<string, unknown> = {}
        for (const field of (node.data as RequestInputsData).fields) {
          outputs[field.id] = inputValues[field.id] ?? null
        }
        nodeOutputs.set(node.id, outputs)
      }
    }

    for (const level of levels) {
      const cropBatch: CropBatchItem[] = []
      const geminiBatch: GeminiBatchItem[] = []

      // Phase 1: handle local-only nodes (Request-Inputs, Response) and prepare batch items
      for (const nodeId of level) {
        const node = nodes.find((n) => n.id === nodeId)
        if (!node) continue

        if (node.data.kind === NodeKind.REQUEST_INPUTS) {
          const outputData = nodeOutputs.get(nodeId) ?? {}
          await prisma.nodeRun.updateMany({
            where: { runId, nodeId },
            data: {
              status: 'SUCCESS',
              startedAt: new Date(),
              finishedAt: new Date(),
              outputData: outputData as Prisma.InputJsonValue,
            },
          })
          continue
        }

        if (node.data.kind === NodeKind.RESPONSE) {
          const resolvedInputs = resolveInputs(nodeId, incomingEdges, nodeOutputs)
          // Collect any imageUrls from upstream sources so the Response card
          // can render thumbnails alongside Gemini text that references them.
          const incoming = incomingEdges.get(nodeId) ?? []
          const imageUrls: string[] = []
          for (const edge of incoming) {
            const src = nodeOutputs.get(edge.source) ?? {}
            const srcImages = src['imageUrls']
            if (Array.isArray(srcImages)) {
              for (const u of srcImages) {
                if (typeof u === 'string' && u.length > 0 && !imageUrls.includes(u)) imageUrls.push(u)
              }
            }
          }
          const outputData = { result: resolvedInputs['result'] ?? null, imageUrls }
          nodeOutputs.set(nodeId, outputData)
          await prisma.nodeRun.updateMany({
            where: { runId, nodeId },
            data: {
              status: 'SUCCESS',
              startedAt: new Date(),
              finishedAt: new Date(),
              inputData: resolvedInputs as Prisma.InputJsonValue,
              outputData: outputData as Prisma.InputJsonValue,
            },
          })
          continue
        }

        // Executable nodes: resolve inputs, mark RUNNING, queue into a batch
        const resolvedInputs = resolveInputs(nodeId, incomingEdges, nodeOutputs)
        await prisma.nodeRun.updateMany({
          where: { runId, nodeId },
          data: {
            status: 'RUNNING',
            startedAt: new Date(),
            inputData: resolvedInputs as Prisma.InputJsonValue,
          },
        })
        const nodeRun = await prisma.nodeRun.findFirst({ where: { runId, nodeId } })
        if (!nodeRun) continue

        if (node.data.kind === NodeKind.CROP_IMAGE) {
          const imageUrl = resolvedInputs['input-image'] as string | undefined
          if (!imageUrl) {
            await prisma.nodeRun.updateMany({
              where: { runId, nodeId },
              data: {
                status: 'FAILED',
                finishedAt: new Date(),
                errorMsg: 'Crop Image requires an input image URL (none provided)',
              },
            })
            continue
          }
          cropBatch.push({
            nodeId,
            payload: {
              imageUrl,
              xPct: node.data.xPct,
              yPct: node.data.yPct,
              wPct: node.data.wPct,
              hPct: node.data.hPct,
              nodeRunId: nodeRun.id,
            },
          })
        } else if (node.data.kind === NodeKind.GEMINI) {
          const prompt = (resolvedInputs['prompt'] ?? node.data.prompt ?? '') as string
          const systemPromptOverride = resolvedInputs['system-prompt'] as string | undefined
          const imageVisionRaw = resolvedInputs['image-vision']
          const imageUrls: string[] = imageVisionRaw
            ? (Array.isArray(imageVisionRaw) ? imageVisionRaw : [imageVisionRaw]).filter(
                (v): v is string => typeof v === 'string' && v.length > 0
              )
            : []
          geminiBatch.push({
            nodeId,
            payload: {
              prompt,
              systemPrompt: systemPromptOverride ?? node.data.systemPrompt,
              imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
              model: node.data.model,
              nodeRunId: nodeRun.id,
            },
          })
        }
      }

      // Phase 2: run crop batch (parallel within the batch)
      if (cropBatch.length > 0) {
        const result = await cropImageTask.batchTriggerAndWait(
          cropBatch.map((c) => ({ payload: c.payload }))
        )
        for (let i = 0; i < cropBatch.length; i++) {
          const item = cropBatch[i]
          const run = result.runs[i]
          if (run.ok) {
            const outputData = { 'output-image': run.output.outputUrl ?? null }
            nodeOutputs.set(item.nodeId, outputData)
            await prisma.nodeRun.updateMany({
              where: { runId, nodeId: item.nodeId },
              data: {
                status: 'SUCCESS',
                finishedAt: new Date(),
                outputData: outputData as Prisma.InputJsonValue,
              },
            })
          } else {
            await prisma.nodeRun.updateMany({
              where: { runId, nodeId: item.nodeId },
              data: {
                status: 'FAILED',
                finishedAt: new Date(),
                errorMsg: String(run.error ?? 'crop-image task failed'),
              },
            })
          }
        }
      }

      // Phase 3: run gemini batch (parallel within the batch)
      if (geminiBatch.length > 0) {
        const result = await geminiTask.batchTriggerAndWait(
          geminiBatch.map((g) => ({ payload: g.payload }))
        )
        for (let i = 0; i < geminiBatch.length; i++) {
          const item = geminiBatch[i]
          const run = result.runs[i]
          if (run.ok) {
            // Persist the imageUrls Gemini received so the UI can render
            // thumbnails alongside the text (Gemini can't generate images,
            // only reference them by "Image 1", "Image 2", etc.)
            const outputData = {
              response: run.output.response ?? '',
              imageUrls: item.payload.imageUrls ?? [],
            }
            nodeOutputs.set(item.nodeId, outputData)
            await prisma.nodeRun.updateMany({
              where: { runId, nodeId: item.nodeId },
              data: {
                status: 'SUCCESS',
                finishedAt: new Date(),
                outputData: outputData as Prisma.InputJsonValue,
              },
            })
          } else {
            await prisma.nodeRun.updateMany({
              where: { runId, nodeId: item.nodeId },
              data: {
                status: 'FAILED',
                finishedAt: new Date(),
                errorMsg: String(run.error ?? 'gemini-inference task failed'),
              },
            })
          }
        }
      }
    }

    // Mark run status based on whether any nodes failed
    const failedCount = await prisma.nodeRun.count({ where: { runId, status: 'FAILED' } })
    const successCount = await prisma.nodeRun.count({ where: { runId, status: 'SUCCESS' } })
    const runStatus = failedCount === 0 ? 'SUCCESS' : successCount > 0 ? 'PARTIAL' : 'FAILED'

    await prisma.run.update({
      where: { id: runId },
      data: { status: runStatus, finishedAt: new Date() },
    })
  },
})
