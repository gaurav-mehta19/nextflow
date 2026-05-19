import { auth } from '@clerk/nextjs'
import { NextResponse } from 'next/server'
import { prisma } from '../../../lib/db/client'
import { CreateWorkflowSchema } from '../../../lib/validations/workflow.schema'
import { ZodError } from 'zod'

export async function GET() {
  try {
    const { userId } = auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const workflows = await prisma.workflow.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        nodes: true,
        edges: true,
        createdAt: true,
        updatedAt: true,
        runs: {
          orderBy: { startedAt: 'desc' },
          take: 1,
          select: { id: true, status: true, startedAt: true },
        },
      },
    })

    return NextResponse.json({ workflows })
  } catch (err) {
    console.error('[GET /api/workflows]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json() as unknown
    const input = CreateWorkflowSchema.parse(body)

    const workflow = await prisma.workflow.create({
      data: {
        userId,
        name: input.name ?? 'New Workflow',
        nodes: [],
        edges: [],
      },
    })

    return NextResponse.json({ workflow }, { status: 201 })
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 422 })
    }
    console.error('[POST /api/workflows]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
