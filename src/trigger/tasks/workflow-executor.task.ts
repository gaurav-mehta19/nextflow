import { task, tasks } from '@trigger.dev/sdk'
import type { Edge } from '@xyflow/react'
import { prisma } from '../../lib/db/client'
import { NodeKind } from '../../lib/types/nodes'
import type { CropImageData, GeminiData, NodeData, RequestInputsData } from '../../lib/types/nodes'
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

// How often (ms) to poll NodeRun rows for completion of in-flight tasks.
// Lower = faster downstream firing latency; higher = lower DB load.
const POLL_MS = 1000

function resolveInputs(
  nodeId: string,
  incomingEdges: Map<string, Edge[]>,
  nodeOutputs: Map<string, Record<string, unknown>>,
): Record<string, unknown> {
  const incoming = incomingEdges.get(nodeId) ?? []
  const resolved: Record<string, unknown> = {}
  for (const edge of incoming) {
    const srcOutputs = nodeOutputs.get(edge.source) ?? {}
    const srcHandle = edge.sourceHandle ?? 'output'
    const tgtHandle = edge.targetHandle ?? 'input'
    const existing = resolved[tgtHandle]
    if (existing !== undefined) {
      resolved[tgtHandle] = Array.isArray(existing)
        ? [...existing, srcOutputs[srcHandle]]
        : [existing, srcOutputs[srcHandle]]
    } else {
      resolved[tgtHandle] = srcOutputs[srcHandle]
    }
  }
  return resolved
}

function pickNumber(
  inputs: Record<string, unknown>,
  handleId: string,
  fallback: number,
): number {
  const v = inputs[handleId]
  if (v === undefined || v === null || v === '') return fallback
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : fallback
}

async function markFailed(runId: string, nodeId: string, errorMsg: string): Promise<void> {
  await prisma.nodeRun.updateMany({
    where: { runId, nodeId },
    data: { status: 'FAILED', finishedAt: new Date(), errorMsg },
  })
}

export const workflowExecutorTask = task({
  id: 'workflow-executor',
  maxDuration: 600,
  run: async (payload: ExecutorPayload): Promise<void> => {
    const { runId, nodes, edges, inputValues } = payload

    // ---- Build static graph indices ----
    const nodeById = new Map(nodes.map((n) => [n.id, n]))
    const dependencies = new Map<string, Set<string>>()
    const incomingEdges = new Map<string, Edge[]>()
    for (const node of nodes) {
      dependencies.set(node.id, new Set())
    }
    for (const edge of edges) {
      dependencies.get(edge.target)?.add(edge.source)
      if (!incomingEdges.has(edge.target)) incomingEdges.set(edge.target, [])
      incomingEdges.get(edge.target)!.push(edge)
    }

    // ---- Scheduler state ----
    const nodeOutputs = new Map<string, Record<string, unknown>>()
    const completed = new Set<string>()
    const failed = new Set<string>()
    const fired = new Set<string>()
    // Gemini's outputData persisted by the gemini task includes imageUrls,
    // so we don't need to remember them per-node here anymore.

    const isExecutable = (kind: NodeKind): boolean =>
      kind === NodeKind.CROP_IMAGE || kind === NodeKind.GEMINI

    // ---- 1. Pre-seed Request-Inputs (instant SUCCESS, all at once) ----
    const requestInputsNodes = nodes.filter((n) => n.data.kind === NodeKind.REQUEST_INPUTS)
    if (requestInputsNodes.length > 0) {
      const now = new Date()
      const updates: Prisma.PrismaPromise<unknown>[] = []
      for (const node of requestInputsNodes) {
        const outputs: Record<string, unknown> = {}
        for (const field of (node.data as RequestInputsData).fields) {
          outputs[field.id] = inputValues[field.id] ?? null
        }
        nodeOutputs.set(node.id, outputs)
        fired.add(node.id)
        completed.add(node.id)
        updates.push(
          prisma.nodeRun.updateMany({
            where: { runId, nodeId: node.id },
            data: {
              status: 'SUCCESS',
              startedAt: now,
              finishedAt: now,
              outputData: outputs as Prisma.InputJsonValue,
            },
          }),
        )
      }
      await prisma.$transaction(updates)
    }

    // ---- 2. Main scheduling loop ----
    // Each iteration:
    //   a) Find nodes whose dependencies are all completed/failed and not yet fired
    //   b) Mark all newly-ready executable nodes RUNNING in one atomic transaction
    //   c) Fire each executable via tasks.trigger() (no wait — true parallelism)
    //   d) Handle Response nodes inline (no external task)
    //   e) Poll NodeRun rows for in-flight tasks; on transition, update state
    while (true) {
      // (a) Find newly-ready nodes
      const ready = nodes.filter((node) => {
        if (fired.has(node.id)) return false
        if (node.data.kind === NodeKind.STICKY_NOTE) return false
        const deps = dependencies.get(node.id)!
        for (const dep of deps) {
          if (!completed.has(dep) && !failed.has(dep)) return false
        }
        return true
      })

      // Split: dep-failed nodes auto-fail; otherwise proceed
      const readyExec: Array<{ node: Node<NodeData>; resolvedInputs: Record<string, unknown> }> = []
      const readyResponse: Array<{ node: Node<NodeData>; resolvedInputs: Record<string, unknown> }> = []
      const dropDepFailed: Node<NodeData>[] = []

      for (const node of ready) {
        const deps = dependencies.get(node.id)!
        const anyDepFailed = [...deps].some((d) => failed.has(d))
        if (anyDepFailed) {
          dropDepFailed.push(node)
          continue
        }
        const resolvedInputs = resolveInputs(node.id, incomingEdges, nodeOutputs)
        if (node.data.kind === NodeKind.RESPONSE) {
          readyResponse.push({ node, resolvedInputs })
        } else if (isExecutable(node.data.kind)) {
          readyExec.push({ node, resolvedInputs })
        }
      }

      // (b) Atomically flip every newly-ready executable node to RUNNING. With
      //     a single transaction, the history poll sees them glow at the same
      //     instant — even though their actual task starts are independent.
      if (readyExec.length > 0) {
        const now = new Date()
        await prisma.$transaction(
          readyExec.map(({ node, resolvedInputs }) =>
            prisma.nodeRun.updateMany({
              where: { runId, nodeId: node.id },
              data: {
                status: 'RUNNING',
                startedAt: now,
                inputData: resolvedInputs as Prisma.InputJsonValue,
              },
            }),
          ),
        )
      }

      // (c) Fire each ready executable. tasks.trigger() returns immediately —
      //     no wait — so multiple in-flight tasks can run concurrently and
      //     independently, exactly matching the assignment spec ("Gemini #2
      //     starts as soon as Gemini #1 finishes — must not wait for Crops").
      for (const { node, resolvedInputs } of readyExec) {
        const nodeRun = await prisma.nodeRun.findFirst({
          where: { runId, nodeId: node.id },
          select: { id: true },
        })
        if (!nodeRun) {
          fired.add(node.id)
          failed.add(node.id)
          await markFailed(runId, node.id, 'NodeRun row missing — cannot fire task')
          continue
        }

        try {
          if (node.data.kind === NodeKind.CROP_IMAGE) {
            const data = node.data as CropImageData
            const imageUrl = resolvedInputs['input-image'] as string | undefined
            if (!imageUrl) {
              await markFailed(runId, node.id, 'Crop Image requires an input image URL (none provided)')
              fired.add(node.id)
              failed.add(node.id)
              continue
            }
            await tasks.trigger<typeof cropImageTask>('crop-image', {
              imageUrl,
              xPct: pickNumber(resolvedInputs, 'input-x-number', data.xPct),
              yPct: pickNumber(resolvedInputs, 'input-y-number', data.yPct),
              wPct: pickNumber(resolvedInputs, 'input-w-number', data.wPct),
              hPct: pickNumber(resolvedInputs, 'input-h-number', data.hPct),
              nodeRunId: nodeRun.id,
            })
          } else if (node.data.kind === NodeKind.GEMINI) {
            const data = node.data as GeminiData
            const prompt = (resolvedInputs['prompt'] ?? data.prompt ?? '') as string
            const systemPromptOverride = resolvedInputs['system-prompt'] as string | undefined
            const imageVisionRaw = resolvedInputs['image-vision']
            const imageUrls: string[] = imageVisionRaw
              ? (Array.isArray(imageVisionRaw) ? imageVisionRaw : [imageVisionRaw]).filter(
                  (v): v is string => typeof v === 'string' && v.length > 0,
                )
              : []
            await tasks.trigger<typeof geminiTask>('gemini-inference', {
              prompt,
              systemPrompt: systemPromptOverride ?? data.systemPrompt,
              imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
              model: data.model,
              nodeRunId: nodeRun.id,
            })
          }
          fired.add(node.id)
        } catch (err) {
          await markFailed(
            runId,
            node.id,
            err instanceof Error ? `Trigger failed: ${err.message}` : 'Trigger failed',
          )
          fired.add(node.id)
          failed.add(node.id)
        }
      }

      // (d) Handle Response nodes inline — pure data propagation, no task fire.
      for (const { node, resolvedInputs } of readyResponse) {
        const incoming = incomingEdges.get(node.id) ?? []
        const imageUrls: string[] = []
        for (const edge of incoming) {
          const src = nodeOutputs.get(edge.source) ?? {}
          const srcImages = src['imageUrls']
          if (Array.isArray(srcImages)) {
            for (const u of srcImages) {
              if (typeof u === 'string' && u.length > 0 && !imageUrls.includes(u)) {
                imageUrls.push(u)
              }
            }
          }
        }
        const outputData = { result: resolvedInputs['result'] ?? null, imageUrls }
        nodeOutputs.set(node.id, outputData)
        const now = new Date()
        await prisma.nodeRun.updateMany({
          where: { runId, nodeId: node.id },
          data: {
            status: 'SUCCESS',
            startedAt: now,
            finishedAt: now,
            inputData: resolvedInputs as Prisma.InputJsonValue,
            outputData: outputData as Prisma.InputJsonValue,
          },
        })
        fired.add(node.id)
        completed.add(node.id)
      }

      // Mark dep-failed nodes (executable or Response) as FAILED so downstream
      // can cascade
      for (const node of dropDepFailed) {
        await markFailed(runId, node.id, 'Upstream dependency failed')
        fired.add(node.id)
        failed.add(node.id)
      }

      // ---- Exit conditions ----
      const accountedFor =
        nodes.filter((n) => n.data.kind !== NodeKind.STICKY_NOTE).length
      if (completed.size + failed.size >= accountedFor) break

      const inFlight = [...fired].filter((id) => !completed.has(id) && !failed.has(id))
      if (inFlight.length === 0) {
        // Nothing in flight and nothing fresh this iteration → unreachable nodes
        const unreached = nodes.filter(
          (n) =>
            !fired.has(n.id) &&
            n.data.kind !== NodeKind.STICKY_NOTE,
        )
        for (const node of unreached) {
          await markFailed(runId, node.id, 'Unreachable from inputs')
          fired.add(node.id)
          failed.add(node.id)
        }
        break
      }

      // (e) Poll in-flight tasks. We sleep briefly, then check NodeRun status.
      await new Promise((r) => setTimeout(r, POLL_MS))

      const statuses = await prisma.nodeRun.findMany({
        where: { runId, nodeId: { in: inFlight } },
        select: { nodeId: true, status: true, outputData: true },
      })

      for (const s of statuses) {
        if (s.status === 'SUCCESS') {
          const node = nodeById.get(s.nodeId)
          if (!node) continue
          // The crop / gemini tasks now write the full output shape directly,
          // so we just copy it into nodeOutputs as-is.
          nodeOutputs.set(s.nodeId, (s.outputData ?? {}) as Record<string, unknown>)
          completed.add(s.nodeId)
        } else if (s.status === 'FAILED') {
          failed.add(s.nodeId)
        }
      }
    }

    // ---- 3. Final run status ----
    const failedCount = await prisma.nodeRun.count({ where: { runId, status: 'FAILED' } })
    const successCount = await prisma.nodeRun.count({ where: { runId, status: 'SUCCESS' } })
    const runStatus = failedCount === 0 ? 'SUCCESS' : successCount > 0 ? 'PARTIAL' : 'FAILED'

    await prisma.run.update({
      where: { id: runId },
      data: { status: runStatus, finishedAt: new Date() },
    })
  },
})
