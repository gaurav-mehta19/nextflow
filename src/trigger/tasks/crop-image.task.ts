import { task } from '@trigger.dev/sdk'
import { createHmac } from 'crypto'
import { prisma } from '../../lib/db/client'

const TRANSLOADIT_KEY = process.env.TRANSLOADIT_KEY ?? ''
const TRANSLOADIT_SECRET = process.env.TRANSLOADIT_SECRET ?? ''

function signAssembly(params: object): string {
  const paramsStr = JSON.stringify(params)
  const hmac = createHmac('sha384', TRANSLOADIT_SECRET)
  hmac.update(Buffer.from(paramsStr, 'utf-8'))
  return `sha384:${hmac.digest('hex')}`
}

interface CropImagePayload {
  imageUrl: string
  xPct: number
  yPct: number
  wPct: number
  hPct: number
  nodeRunId: string
}

export const cropImageTask = task({
  id: 'crop-image',
  // Mark NodeRun FAILED only after all retries are exhausted — single-attempt
  // failures still get retried per trigger.config.ts.
  onFailure: async ({ payload, error }) => {
    await prisma.nodeRun.update({
      where: { id: payload.nodeRunId },
      data: {
        status: 'FAILED',
        finishedAt: new Date(),
        errorMsg: error instanceof Error ? error.message : String(error),
      },
    }).catch(() => { /* NodeRun row may not exist; swallow */ })
  },
  run: async (payload: CropImagePayload): Promise<{ outputUrl: string }> => {
    const { imageUrl, xPct, yPct, wPct, hPct, nodeRunId } = payload

    await prisma.nodeRun.update({
      where: { id: nodeRunId },
      data: { status: 'RUNNING', startedAt: new Date() },
    })

    // Mandatory artificial delay: 30-35 seconds
    await new Promise((r) => setTimeout(r, 30000 + Math.random() * 5000))

    // Convert x/y/w/h percentages to x1/y1/x2/y2 corner coordinates
    // that the /image/resize robot's `crop` parameter expects.
    const x1Pct = Math.max(0, Math.min(100, xPct))
    const y1Pct = Math.max(0, Math.min(100, yPct))
    const x2Pct = Math.max(0, Math.min(100, xPct + wPct))
    const y2Pct = Math.max(0, Math.min(100, yPct + hPct))

    const templateSteps = {
      import: {
        robot: '/http/import',
        url: imageUrl,
      },
      crop: {
        robot: '/image/resize',
        use: 'import',
        crop: {
          x1: `${x1Pct}%`,
          y1: `${y1Pct}%`,
          x2: `${x2Pct}%`,
          y2: `${y2Pct}%`,
        },
        result: true,
      },
    }

    const assemblyPayload = {
      auth: {
        key: TRANSLOADIT_KEY,
        expires: new Date(Date.now() + 3600_000).toISOString().replace(/\.\d{3}Z$/, '+00:00'),
      },
      steps: templateSteps,
    }

    const form = new FormData()
    const paramsStr = JSON.stringify(assemblyPayload)
    form.append('params', paramsStr)
    form.append('signature', signAssembly(assemblyPayload))

    // Create Transloadit assembly
    const createRes = await fetch('https://api2.transloadit.com/assemblies', {
      method: 'POST',
      body: form,
    })

    if (!createRes.ok) {
      const body = await createRes.text().catch(() => '')
      throw new Error(
        `Transloadit assembly creation failed: HTTP ${createRes.status} ${createRes.statusText} — ${body.slice(0, 500)}`
      )
    }

    const assemblyData = (await createRes.json()) as {
      assembly_id: string
      assembly_ssl_url: string
      results?: Record<string, Array<{ ssl_url: string }>>
      ok?: string
      error?: string
    }

    // Poll until complete
    let attempts = 0
    let outputUrl = ''

    while (attempts < 60) {
      await new Promise((r) => setTimeout(r, 2000))
      const statusRes = await fetch(assemblyData.assembly_ssl_url)
      const status = (await statusRes.json()) as {
        ok?: string
        error?: string
        message?: string
        reason?: string
        results?: Record<string, Array<{ ssl_url: string }>>
      }

      if (status.ok === 'ASSEMBLY_COMPLETED') {
        const cropResult = status.results?.crop?.[0]
        outputUrl = cropResult?.ssl_url ?? imageUrl
        break
      }
      if (status.error) {
        const detail = status.message || status.reason || ''
        throw new Error(
          `Transloadit error: ${status.error}${detail ? ` — ${detail}` : ''}` +
          ` (source URL: ${imageUrl.slice(0, 120)})`
        )
      }
      attempts++
    }

    if (!outputUrl) {
      outputUrl = imageUrl
    }

    // Write the full output shape downstream nodes expect — keyed by the
    // source handle id 'output-image' so resolveInputs() picks it up
    // directly without the executor needing to transform it.
    await prisma.nodeRun.update({
      where: { id: nodeRunId },
      data: {
        status: 'SUCCESS',
        finishedAt: new Date(),
        outputData: { 'output-image': outputUrl },
      },
    })

    return { outputUrl }
  },
})
