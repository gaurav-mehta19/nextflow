import type { NodeTypes } from '@xyflow/react'
import { RequestInputsNode } from './RequestInputsNode'
import { ResponseNode } from './ResponseNode'
import { CropImageNode } from './CropImageNode'
import { GeminiNode } from './GeminiNode'
import { StickyNoteNode } from './StickyNoteNode'

export const nodeTypes: NodeTypes = {
  requestInputs: RequestInputsNode,
  response: ResponseNode,
  cropImage: CropImageNode,
  gemini: GeminiNode,
  stickyNote: StickyNoteNode,
}

export { RequestInputsNode, ResponseNode, CropImageNode, GeminiNode, StickyNoteNode }
