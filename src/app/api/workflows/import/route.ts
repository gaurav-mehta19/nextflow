import { auth } from '@clerk/nextjs'
import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/db/client'
import { ImportWorkflowSchema } from '../../../../lib/validations/workflow.schema'
import { ZodError } from 'zod'
import type { Prisma } from '@/generated/prisma/client'

export async function POST(request: Request) {
  try {
    const { userId } = auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json() as unknown
    const input = ImportWorkflowSchema.parse(body)

    const workflow = await prisma.workflow.create({
      data: {
        userId,
        name: input.name,
        nodes: input.nodes as Prisma.InputJsonValue,
        edges: input.edges as Prisma.InputJsonValue,
      },
    })

    return NextResponse.json({ workflow }, { status: 201 })
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 422 })
    }
    console.error('[POST /api/workflows/import]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
