import { auth } from '@clerk/nextjs'
import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/db/client'
import { RunWorkflowSchema } from '../../../../../lib/validations/workflow.schema'
import { ZodError } from 'zod'
import type { Node, Edge } from '@xyflow/react'
import type { NodeData } from '../../../../../lib/types/nodes'
import { RunScope } from '@/generated/prisma/client'
import { workflowExecutorTask } from '../../../../../trigger/tasks/workflow-executor.task'
import { runTag, workflowTag } from '../../../../../lib/trigger/tags'

interface RouteParams {
  params: { id: string }
}

const SCOPE_MAP: Record<string, RunScope> = {
  full: RunScope.FULL,
  partial: RunScope.PARTIAL,
  single: RunScope.SINGLE,
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { userId } = auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const workflow = await prisma.workflow.findFirst({
      where: { id: params.id, userId },
    })
    if (!workflow) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = await request.json() as unknown
    const input = RunWorkflowSchema.parse(body)

    const nodes = input.nodes as Node<NodeData>[]
    const edges = input.edges as Edge[]

    const run = await prisma.run.create({
      data: {
        workflowId: params.id,
        status: 'RUNNING',
        scope: SCOPE_MAP[input.scope] ?? RunScope.FULL,
      },
    })

    await prisma.nodeRun.createMany({
      data: nodes.map((node) => ({
        runId: run.id,
        nodeId: node.id,
        nodeType: (node.data as NodeData).kind ?? 'unknown',
        status: 'PENDING' as const,
      })),
    })

    await workflowExecutorTask.trigger(
      {
        runId: run.id,
        workflowId: params.id,
        nodes,
        edges,
        inputValues: input.inputValues as Record<string, unknown>,
      },
      {
        tags: [workflowTag(params.id), runTag(run.id)],
      },
    )

    return NextResponse.json({ runId: run.id }, { status: 201 })
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 422 })
    }
    console.error('[POST /api/workflows/[id]/run]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
