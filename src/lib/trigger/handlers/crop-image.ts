import { wait } from '@trigger.dev/sdk'
import { createHmac } from 'crypto'
import type { Node } from '@xyflow/react'
import type { CropImageData } from '../../types/nodes'
import type { HandlerOutput, NodeContext } from './types'

const TRANSLOADIT_KEY = process.env.TRANSLOADIT_KEY ?? ''
const TRANSLOADIT_SECRET = process.env.TRANSLOADIT_SECRET ?? ''

interface AssemblyStatus {
  ok?: string
  error?: string
  message?: string
  reason?: string
  results?: Record<string, Array<{ ssl_url: string }>>
}

function signAssembly(params: object): string {
  const hmac = createHmac('sha384', TRANSLOADIT_SECRET)
  hmac.update(Buffer.from(JSON.stringify(params), 'utf-8'))
  return `sha384:${hmac.digest('hex')}`
}

function pickNumber(inputs: Record<string, unknown>, key: string, fallback: number): number {
  const v = inputs[key]
  if (v === undefined || v === null || v === '') return fallback
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : fallback
}

function buildAssembly(imageUrl: string, x: number, y: number, w: number, h: number) {
  const clamp = (v: number) => Math.max(0, Math.min(100, v))
  return {
    auth: {
      key: TRANSLOADIT_KEY,
      expires: new Date(Date.now() + 3600_000).toISOString().replace(/\.\d{3}Z$/, '+00:00'),
    },
    steps: {
      import: { robot: '/http/import', url: imageUrl },
      crop: {
        robot: '/image/resize',
        use: 'import',
        crop: {
          x1: `${clamp(x)}%`,
          y1: `${clamp(y)}%`,
          x2: `${clamp(x + w)}%`,
          y2: `${clamp(y + h)}%`,
        },
        result: true,
      },
    },
  }
}

async function pollAssembly(statusUrl: string, fallbackUrl: string): Promise<string> {
  for (let i = 0; i < 60; i++) {
    await wait.for({ seconds: 2 })
    const res = await fetch(statusUrl)
    const status = (await res.json()) as AssemblyStatus
    if (status.ok === 'ASSEMBLY_COMPLETED') {
      return status.results?.crop?.[0]?.ssl_url ?? fallbackUrl
    }
    if (status.error) {
      const detail = status.message || status.reason || ''
      throw new Error(`Transloadit error: ${status.error}${detail ? ` — ${detail}` : ''}`)
    }
  }
  return fallbackUrl
}

export async function runCropImage(
  ctx: NodeContext,
  node: Node<CropImageData>,
): Promise<HandlerOutput> {
  const data = node.data
  const imageUrl = ctx.resolvedInputs['input-image'] as string | undefined
  if (!imageUrl) {
    throw new Error('Crop Image requires an input image URL (none provided)')
  }


  await wait.for({ seconds: 30 })

  const x = pickNumber(ctx.resolvedInputs, 'input-x-number', data.xPct)
  const y = pickNumber(ctx.resolvedInputs, 'input-y-number', data.yPct)
  const w = pickNumber(ctx.resolvedInputs, 'input-w-number', data.wPct)
  const h = pickNumber(ctx.resolvedInputs, 'input-h-number', data.hPct)

  const payload = buildAssembly(imageUrl, x, y, w, h)
  const form = new FormData()
  form.append('params', JSON.stringify(payload))
  form.append('signature', signAssembly(payload))

  const createRes = await fetch('https://api2.transloadit.com/assemblies', {
    method: 'POST',
    body: form,
  })
  if (!createRes.ok) {
    const body = await createRes.text().catch(() => '')
    throw new Error(
      `Transloadit assembly creation failed: HTTP ${createRes.status} — ${body.slice(0, 200)}`,
    )
  }

  const created = (await createRes.json()) as { assembly_ssl_url: string }
  const outputUrl = await pollAssembly(created.assembly_ssl_url, imageUrl)

  return { outputData: { 'output-image': outputUrl } }
}
