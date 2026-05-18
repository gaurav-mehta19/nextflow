export enum HandleType {
  TEXT = 'text',
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  FILE = 'file',
}

export const HANDLE_COLORS: Record<HandleType, string> = {
  [HandleType.TEXT]: '#f97316',
  [HandleType.IMAGE]: '#3b82f6',
  [HandleType.VIDEO]: '#a855f7',
  [HandleType.AUDIO]: '#22c55e',
  [HandleType.FILE]: '#6b7280',
}
