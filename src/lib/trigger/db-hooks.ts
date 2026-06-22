import { prisma } from '../db/client'
import type { Prisma } from '@/generated/prisma/client'

export async function getNodeRunByNodeId(
  runId: string,
  nodeId: string,
): Promise<{ id: string } | null> {
  return prisma.nodeRun.findFirst({
    where: { runId, nodeId },
    select: { id: true },
  })
}

export async function markRunning(
  nodeRunId: string,
  inputData: Record<string, unknown>,
): Promise<void> {
  await prisma.nodeRun.update({
    where: { id: nodeRunId },
    data: {
      status: 'RUNNING',
      startedAt: new Date(),
      inputData: inputData as Prisma.InputJsonValue,
    },
  })
}

export async function markSuccess(
  nodeRunId: string,
  outputData: Record<string, unknown>,
): Promise<void> {
  await prisma.nodeRun.update({
    where: { id: nodeRunId },
    data: {
      status: 'SUCCESS',
      finishedAt: new Date(),
      outputData: outputData as Prisma.InputJsonValue,
    },
  })
}

export async function markFailedByNode(
  runId: string,
  nodeId: string,
  errorMsg: string,
): Promise<void> {
  try {
    await prisma.nodeRun.updateMany({
      where: { runId, nodeId },
      data: { status: 'FAILED', finishedAt: new Date(), errorMsg },
    })
  } catch (err) {

    console.error('[markFailedByNode] swallowed', { runId, nodeId, err })
  }
}

export async function writeRequestInputsSuccess(
  runId: string,
  nodeId: string,
  outputData: Record<string, unknown>,
): Promise<void> {
  const now = new Date()
  await prisma.nodeRun.updateMany({
    where: { runId, nodeId },
    data: {
      status: 'SUCCESS',
      startedAt: now,
      finishedAt: now,
      outputData: outputData as Prisma.InputJsonValue,
    },
  })
}

export async function writeResponseSuccess(
  runId: string,
  nodeId: string,
  inputData: Record<string, unknown>,
  outputData: Record<string, unknown>,
): Promise<void> {
  const now = new Date()
  await prisma.nodeRun.updateMany({
    where: { runId, nodeId },
    data: {
      status: 'SUCCESS',
      startedAt: now,
      finishedAt: now,
      inputData: inputData as Prisma.InputJsonValue,
      outputData: outputData as Prisma.InputJsonValue,
    },
  })
}

export async function finalizeRun(runId: string): Promise<'SUCCESS' | 'PARTIAL' | 'FAILED'> {
  const [failedCount, successCount] = await Promise.all([
    prisma.nodeRun.count({ where: { runId, status: 'FAILED' } }),
    prisma.nodeRun.count({ where: { runId, status: 'SUCCESS' } }),
  ])
  const status = failedCount === 0 ? 'SUCCESS' : successCount > 0 ? 'PARTIAL' : 'FAILED'
  await prisma.run.update({
    where: { id: runId },
    data: { status, finishedAt: new Date() },
  })
  return status
}
