import { GoogleGenerativeAI, type Part } from '@google/generative-ai'
import type { Node } from '@xyflow/react'
import type { GeminiData } from '../../types/nodes'
import type { HandlerOutput, NodeContext } from './types'

const MODEL_ALIASES: Record<string, string> = {
  'gemini-3.1-pro': 'gemini-2.5-pro',
  'gemini-3-flash': 'gemini-2.5-flash',
  'gemini-2.5-flash-preview-05-20': 'gemini-2.5-flash',
  'gemini-2.5-pro-preview-05-06': 'gemini-2.5-pro',
  'gemini-1.5-pro': 'gemini-2.5-pro',
}

function resolveModel(requested: string | undefined): string {
  const want = requested || 'gemini-2.5-pro'
  return MODEL_ALIASES[want] ?? want
}

function collectImageUrls(raw: unknown): string[] {
  if (!raw) return []
  const arr = Array.isArray(raw) ? raw : [raw]
  return arr.filter((v): v is string => typeof v === 'string' && v.length > 0)
}

async function fetchImagePart(url: string): Promise<Part> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Failed to fetch image for Gemini: HTTP ${res.status} on ${url.slice(0, 80)}`)
  }
  const buf = await res.arrayBuffer()
  return {
    inlineData: {
      mimeType: res.headers.get('content-type') ?? 'image/jpeg',
      data: Buffer.from(buf).toString('base64'),
    },
  }
}

export async function runGemini(
  ctx: NodeContext,
  node: Node<GeminiData>,
): Promise<HandlerOutput> {
  const data = node.data
  const inputs = ctx.resolvedInputs
  const prompt = (inputs['prompt'] ?? data.prompt ?? '') as string
  const systemPrompt = (inputs['system-prompt'] as string | undefined) ?? data.systemPrompt
  const imageUrls = collectImageUrls(inputs['image-vision'])

  const client = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY ?? '')
  const model = client.getGenerativeModel({
    model: resolveModel(data.model),
    ...(systemPrompt
      ? { systemInstruction: { role: 'system', parts: [{ text: systemPrompt }] } }
      : {}),
  })

  const parts: Part[] = [{ text: prompt }]
  for (const url of imageUrls) {
    parts.push(await fetchImagePart(url))
  }

  const result = await model.generateContent({ contents: [{ role: 'user', parts }] })
  const responseText = result.response.text()

  return {
    outputData: { response: responseText, imageUrls },
  }
}
