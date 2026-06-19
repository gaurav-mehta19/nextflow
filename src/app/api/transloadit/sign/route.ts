import { auth } from '@clerk/nextjs'
import { NextResponse } from 'next/server'
import { createHmac } from 'crypto'

export async function POST() {
  const { userId } = auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const key = process.env.TRANSLOADIT_KEY ?? ''
  const secret = process.env.TRANSLOADIT_SECRET ?? ''
  if (!key || !secret) {
    return NextResponse.json({ error: 'Transloadit not configured' }, { status: 500 })
  }



  const params = {
    auth: {
      key,
      expires: new Date(Date.now() + 60 * 60 * 1000).toISOString().replace(/\.\d{3}Z$/, '+00:00'),
    },
    steps: {
      ':original': {
        robot: '/upload/handle',
        result: true,
      },
    },
  }

  const paramsStr = JSON.stringify(params)
  const hmac = createHmac('sha384', secret)
  hmac.update(Buffer.from(paramsStr, 'utf-8'))
  const signature = `sha384:${hmac.digest('hex')}`

  return NextResponse.json({ params: paramsStr, signature })
}
