export enum NodeKind {
  REQUEST_INPUTS = 'requestInputs',
  RESPONSE       = 'response',
  CROP_IMAGE     = 'cropImage',
  GEMINI         = 'gemini',
}

export type FieldType = 'text_field' | 'image_field' | 'video_field' | 'audio_field' | 'file_field'

export interface FieldDef {
  id: string
  label: string
  type: FieldType
  value?: string
  fileName?: string
}

export interface RequestInputsData extends Record<string, unknown> {
  kind: NodeKind.REQUEST_INPUTS
  fields: FieldDef[]
}

export interface CropImageData extends Record<string, unknown> {
  kind: NodeKind.CROP_IMAGE
  xPct: number
  yPct: number
  wPct: number
  hPct: number
}

export interface GeminiData extends Record<string, unknown> {
  kind: NodeKind.GEMINI
  systemPrompt: string
  model: string
  temperature?: number
  maxTokens?: number
  prompt?: string
  imageUrl?: string
  videoUrl?: string
  videoFileName?: string
  audioUrl?: string
  audioFileName?: string
  fileUrl?: string
  fileName?: string
}

export interface ResponseData extends Record<string, unknown> {
  kind: NodeKind.RESPONSE
}

export type NodeData =
  | RequestInputsData
  | CropImageData
  | GeminiData
  | ResponseData
