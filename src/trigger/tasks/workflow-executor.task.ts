import { task, batch } from '@trigger.dev/sdk'
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

function pickNumber(
  resolvedInputs: Record<string, unknown>,
  handleId: string,
  fallback: number,
): number {
  const v = resolvedInputs[handleId]
  if (v === undefined || v === null || v === '') return fallback
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : fallback
}

async function processCropResult(
  runId: string,
  nodeId: string,
  nodeOutputs: Map<string, Record<string, unknown>>,
  run: { ok: boolean; output?: { outputUrl?: string | null }; error?: unknown },
): Promise<void> {
  if (run.ok) {
    const outputData = { 'output-image': run.output?.outputUrl ?? null }
    nodeOutputs.set(nodeId, outputData)
    await prisma.nodeRun.updateMany({
      where: { runId, nodeId },
      data: {
        status: 'SUCCESS',
        finishedAt: new Date(),
        outputData: outputData as Prisma.InputJsonValue,
      },
    })
  } else {
    await prisma.nodeRun.updateMany({
      where: { runId, nodeId },
      data: {
        status: 'FAILED',
        finishedAt: new Date(),
        errorMsg: String(run.error ?? 'crop-image task failed'),
      },
    })
  }
}

async function processGeminiResult(
  runId: string,
  nodeId: string,
  nodeOutputs: Map<string, Record<string, unknown>>,
  payloadImageUrls: string[] | undefined,
  run: { ok: boolean; output?: { response?: string }; error?: unknown },
): Promise<void> {
  if (run.ok) {
    // Persist the imageUrls Gemini received so the UI can render thumbnails
    // alongside the text (Gemini can't generate images, only reference them
    // by "Image 1", "Image 2", etc.)
    const outputData = {
      response: run.output?.response ?? '',
      imageUrls: payloadImageUrls ?? [],
    }
    nodeOutputs.set(nodeId, outputData)
    await prisma.nodeRun.updateMany({
      where: { runId, nodeId },
      data: {
        status: 'SUCCESS',
        finishedAt: new Date(),
        outputData: outputData as Prisma.InputJsonValue,
      },
    })
  } else {
    await prisma.nodeRun.updateMany({
      where: { runId, nodeId },
      data: {
        status: 'FAILED',
        finishedAt: new Date(),
        errorMsg: String(run.error ?? 'gemini-inference task failed'),
      },
    })
  }
}

export const workflowExecutorTask = task({
  id: 'workflow-executor',
  maxDuration: 600,
  run: async (payload: ExecutorPayload): Promise<void> => {
    const { runId, nodes, edges, inputValues } = payload

    const graphNodes = nodes.map((n) => ({ id: n.id }))
    const graphEdges = edges.map((e) => ({ source: e.source, target: e.target }))
    const levels = topologicalSort(graphNodes, graphEdges)

    const nodeById = new Map(nodes.map((n) => [n.id, n]))
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

      // Pre-fetch NodeRuns for this level so we can build batch payloads
      // without an await-per-node round-trip.
      const levelNodeRuns = await prisma.nodeRun.findMany({
        where: { runId, nodeId: { in: level } },
      })
      const nodeRunByNodeId = new Map(levelNodeRuns.map((nr) => [nr.nodeId, nr]))

      // Collect RUNNING updates so we can flip every same-level executable node
      // in a single atomic transaction — the history poll then sees them glow
      // together instead of in sequence.
      const runningUpdates: Array<{ nodeId: string; inputData: unknown }> = []

      // Phase 1: handle local-only nodes (Request-Inputs, Response) and prepare batch items
      for (const nodeId of level) {
        const node = nodeById.get(nodeId)
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

        // Executable nodes: resolve inputs and queue into a batch (status flip happens below)
        const resolvedInputs = resolveInputs(nodeId, incomingEdges, nodeOutputs)
        const nodeRun = nodeRunByNodeId.get(nodeId)
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
              xPct: pickNumber(resolvedInputs, 'input-x-number', node.data.xPct),
              yPct: pickNumber(resolvedInputs, 'input-y-number', node.data.yPct),
              wPct: pickNumber(resolvedInputs, 'input-w-number', node.data.wPct),
              hPct: pickNumber(resolvedInputs, 'input-h-number', node.data.hPct),
              nodeRunId: nodeRun.id,
            },
          })
          runningUpdates.push({ nodeId, inputData: resolvedInputs })
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
          runningUpdates.push({ nodeId, inputData: resolvedInputs })
        }
      }

      // Phase 1b: flip every same-level executable node to RUNNING in one atomic
      // transaction so the history poll renders them glowing simultaneously.
      if (runningUpdates.length > 0) {
        const now = new Date()
        await prisma.$transaction(
          runningUpdates.map((u) =>
            prisma.nodeRun.updateMany({
              where: { runId, nodeId: u.nodeId },
              data: {
                status: 'RUNNING',
                startedAt: now,
                inputData: u.inputData as Prisma.InputJsonValue,
              },
            }),
          ),
        )
      }

      // Phase 2: kick off every executable in the level concurrently.
      // - Mixed crop+gemini level → use batch.triggerByTaskAndWait so they
      //   actually start at the same instant.
      // - Single task-type level → use that task's batchTriggerAndWait. The
      //   cross-task helper has been observed to hang on single-item inputs.
      const isMixed = cropBatch.length > 0 && geminiBatch.length > 0

      if (isMixed) {
        type CombinedItem =
          | { kind: 'crop'; nodeId: string; payload: CropBatchItem['payload'] }
          | { kind: 'gemini'; nodeId: string; payload: GeminiBatchItem['payload'] }

        const combined: CombinedItem[] = [
          ...cropBatch.map((c) => ({ kind: 'crop' as const, nodeId: c.nodeId, payload: c.payload })),
          ...geminiBatch.map((g) => ({ kind: 'gemini' as const, nodeId: g.nodeId, payload: g.payload })),
        ]

        const result = await batch.triggerByTaskAndWait(
          combined.map((item) =>
            item.kind === 'crop'
              ? { task: cropImageTask, payload: item.payload }
              : { task: geminiTask, payload: item.payload },
          ),
        )

        for (let i = 0; i < combined.length; i++) {
          const item = combined[i]
          const run = result.runs[i]
          if (item.kind === 'crop') {
            await processCropResult(
              runId,
              item.nodeId,
              nodeOutputs,
              run as Parameters<typeof processCropResult>[3],
            )
          } else {
            await processGeminiResult(
              runId,
              item.nodeId,
              nodeOutputs,
              item.payload.imageUrls,
              run as Parameters<typeof processGeminiResult>[4],
            )
          }
        }
      } else if (cropBatch.length > 0) {
        const result = await cropImageTask.batchTriggerAndWait(
          cropBatch.map((c) => ({ payload: c.payload })),
        )
        for (let i = 0; i < cropBatch.length; i++) {
          await processCropResult(runId, cropBatch[i].nodeId, nodeOutputs, result.runs[i])
        }
      } else if (geminiBatch.length > 0) {
        const result = await geminiTask.batchTriggerAndWait(
          geminiBatch.map((g) => ({ payload: g.payload })),
        )
        for (let i = 0; i < geminiBatch.length; i++) {
          await processGeminiResult(
            runId,
            geminiBatch[i].nodeId,
            nodeOutputs,
            geminiBatch[i].payload.imageUrls,
            result.runs[i],
          )
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
