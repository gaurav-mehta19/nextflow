import { task } from '@trigger.dev/sdk'
import { GoogleGenerativeAI, type Part } from '@google/generative-ai'
import { prisma } from '../../lib/db/client'

interface GeminiPayload {
  prompt: string
  systemPrompt?: string
  imageUrls?: string[]
  model: string
  nodeRunId: string
}

export const geminiTask = task({
  id: 'gemini-inference',
  run: async (payload: GeminiPayload): Promise<{ response: string }> => {
    const { prompt, systemPrompt, imageUrls, model, nodeRunId } = payload

    await prisma.nodeRun.update({
      where: { id: nodeRunId },
      data: { status: 'RUNNING', startedAt: new Date() },
    })

    // Map deprecated / not-yet-available model IDs to a working stable one
    const MODEL_ALIASES: Record<string, string> = {
      'gemini-3.1-pro': 'gemini-2.5-pro',
      'gemini-3-flash': 'gemini-2.5-flash',
      'gemini-2.5-flash-preview-05-20': 'gemini-2.5-flash',
      'gemini-2.5-pro-preview-05-06': 'gemini-2.5-pro',
      'gemini-1.5-pro': 'gemini-2.5-pro',
    }
    const requestedModel = model || 'gemini-2.5-pro'
    const resolvedModel = MODEL_ALIASES[requestedModel] ?? requestedModel

    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY ?? '')
    const generativeModel = genAI.getGenerativeModel({
      model: resolvedModel,
      ...(systemPrompt ? { systemInstruction: { role: 'system', parts: [{ text: systemPrompt }] } } : {}),
    })

    const parts: Part[] = [{ text: prompt }]

    if (imageUrls && imageUrls.length > 0) {
      for (const url of imageUrls) {
        const imageRes = await fetch(url)
        if (!imageRes.ok) {
          throw new Error(`Failed to fetch image for Gemini vision: HTTP ${imageRes.status} on ${url.slice(0, 80)}`)
        }
        const imageBuffer = await imageRes.arrayBuffer()
        const base64 = Buffer.from(imageBuffer).toString('base64')
        const contentType = imageRes.headers.get('content-type') ?? 'image/jpeg'

        parts.push({
          inlineData: {
            mimeType: contentType,
            data: base64,
          },
        })
      }
    }

    const result = await generativeModel.generateContent({
      contents: [{ role: 'user', parts }],
    })

    const responseText = result.response.text()

    await prisma.nodeRun.update({
      where: { id: nodeRunId },
      data: {
        status: 'SUCCESS',
        finishedAt: new Date(),
        outputData: { response: responseText },
      },
    })

    return { response: responseText }
  },
})
