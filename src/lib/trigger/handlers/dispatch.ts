import type { Node } from '@xyflow/react'
import { NodeKind, type CropImageData, type GeminiData, type NodeData } from '../../types/nodes'
import { runCropImage } from './crop-image'
import { runGemini } from './gemini'
import type { HandlerOutput, NodeContext } from './types'

export async function runExecutableNode(
  ctx: NodeContext,
  node: Node<NodeData>,
): Promise<HandlerOutput> {
  switch (node.data.kind) {
    case NodeKind.CROP_IMAGE:
      return runCropImage(ctx, node as Node<CropImageData>)
    case NodeKind.GEMINI:
      return runGemini(ctx, node as Node<GeminiData>)
    default:
      throw new Error(`Not an executable node kind: ${node.data.kind}`)
  }
}
