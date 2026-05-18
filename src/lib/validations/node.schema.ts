import { z } from 'zod'

export const FieldDefSchema = z.object({
  id: z.string(),
  label: z.string(),
  type: z.enum(['text_field', 'image_field']),
})

export const RequestInputsDataSchema = z.object({
  kind: z.literal('requestInputs'),
  fields: z.array(FieldDefSchema),
})

export const CropImageDataSchema = z.object({
  kind: z.literal('cropImage'),
  xPct: z.number().min(0).max(100),
  yPct: z.number().min(0).max(100),
  wPct: z.number().min(0).max(100),
  hPct: z.number().min(0).max(100),
})

export const GeminiDataSchema = z.object({
  kind: z.literal('gemini'),
  systemPrompt: z.string(),
  model: z.string(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
})

export const ResponseDataSchema = z.object({
  kind: z.literal('response'),
})

export const NodeDataSchema = z.discriminatedUnion('kind', [
  RequestInputsDataSchema,
  CropImageDataSchema,
  GeminiDataSchema,
  ResponseDataSchema,
])
