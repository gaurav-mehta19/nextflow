export enum HandleType {
  TEXT = 'text',
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  FILE = 'file',
  NUMBER = 'number',
}

export const HANDLE_COLORS: Record<HandleType, string> = {
  [HandleType.TEXT]: '#f97316',
  [HandleType.IMAGE]: '#3b82f6',
  [HandleType.VIDEO]: '#a855f7',
  [HandleType.AUDIO]: '#22c55e',
  [HandleType.FILE]: '#6b7280',
  [HandleType.NUMBER]: '#ec4899',
}

/**
 * Derive the handle's data type from its ID. Handle IDs encode the type via
 * substring (e.g. `image_field-…`, `input-x-number`), so adding a new
 * HandleType only requires extending this function plus HANDLE_COLORS.
 */
export function inferHandleType(handleId: string | null | undefined): HandleType {
  if (!handleId) return HandleType.TEXT
  if (handleId.includes('number')) return HandleType.NUMBER
  if (handleId.includes('image')) return HandleType.IMAGE
  if (handleId.includes('video')) return HandleType.VIDEO
  if (handleId.includes('audio')) return HandleType.AUDIO
  if (handleId.includes('file')) return HandleType.FILE
  return HandleType.TEXT
}
