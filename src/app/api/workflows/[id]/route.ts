import { auth } from '@clerk/nextjs'
import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/db/client'
import { UpdateWorkflowSchema } from '../../../../lib/validations/workflow.schema'
import { ZodError } from 'zod'
import type { Prisma } from '@/generated/prisma/client'

interface RouteParams {
  params: { id: string }
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { userId } = auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const workflow = await prisma.workflow.findFirst({
      where: { id: params.id, userId },
    })

    if (!workflow) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json({ workflow })
  } catch (err) {
    console.error('[GET /api/workflows/[id]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { userId } = auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const existing = await prisma.workflow.findFirst({
      where: { id: params.id, userId },
      select: { id: true },
    })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = await request.json() as unknown
    const input = UpdateWorkflowSchema.parse(body)

    const updateData: Prisma.WorkflowUpdateInput = {}
    if (input.name !== undefined) updateData.name = input.name
    if (input.nodes !== undefined) updateData.nodes = input.nodes as Prisma.InputJsonValue
    if (input.edges !== undefined) updateData.edges = input.edges as Prisma.InputJsonValue

    const workflow = await prisma.workflow.update({
      where: { id: params.id },
      data: updateData,
    })

    return NextResponse.json({ workflow })
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 422 })
    }
    console.error('[PATCH /api/workflows/[id]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { userId } = auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const existing = await prisma.workflow.findFirst({
      where: { id: params.id, userId },
      select: { id: true },
    })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await prisma.workflow.delete({ where: { id: params.id } })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/workflows/[id]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
