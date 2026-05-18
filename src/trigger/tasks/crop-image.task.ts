import { task } from '@trigger.dev/sdk/v3'
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
  run: async (payload: CropImagePayload): Promise<{ outputUrl: string }> => {
    const { imageUrl, xPct, yPct, wPct, hPct, nodeRunId } = payload

    await prisma.nodeRun.update({
      where: { id: nodeRunId },
      data: { status: 'RUNNING', startedAt: new Date() },
    })

    // Mandatory artificial delay: 30-35 seconds
    await new Promise((r) => setTimeout(r, 30000 + Math.random() * 5000))

    // Build Transloadit assembly for FFmpeg crop
    const templateSteps = {
      import: {
        robot: '/http/import',
        url: imageUrl,
      },
      crop: {
        robot: '/image/resize',
        use: 'import',
        crop: {
          x: `${xPct}%`,
          y: `${yPct}%`,
          w: `${wPct}%`,
          h: `${hPct}%`,
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
        results?: Record<string, Array<{ ssl_url: string }>>
      }

      if (status.ok === 'ASSEMBLY_COMPLETED') {
        const cropResult = status.results?.crop?.[0]
        outputUrl = cropResult?.ssl_url ?? imageUrl
        break
      }
      if (status.error) {
        throw new Error(`Transloadit error: ${status.error}`)
      }
      attempts++
    }

    if (!outputUrl) {
      outputUrl = imageUrl
    }

    await prisma.nodeRun.update({
      where: { id: nodeRunId },
      data: { status: 'SUCCESS', finishedAt: new Date(), outputData: { outputUrl } },
    })

    return { outputUrl }
  },
})
