import type { Node, Edge } from '@xyflow/react'
import type { NodeData, RequestInputsData, CropImageData, GeminiData, ResponseData } from './types/nodes'
import { NodeKind } from './types/nodes'

const SAMPLE_MODEL = 'gemini-2.5-pro'

export function buildSampleWorkflow(): { nodes: Node<NodeData>[]; edges: Edge[] } {
  // Layout (3 rows × 5 columns of 340px-wide cards with ~80px gutters):
  //
  //   Row 1 (y=20):                [Gemini #1]     [Gemini #2]
  //   Row 2 (y=400):  [Inputs]                                    [Final Gemini]    [Response]
  //   Row 3 (y=780):               [Crop #1]       [Crop #2]
  //
  const COL = { inputs: 60, mid1: 500, mid2: 940, final: 1380, response: 1820 }
  const ROW = { top: 20, middle: 400, bottom: 780 }

  const nodes: Array<Node<RequestInputsData> | Node<CropImageData> | Node<GeminiData> | Node<ResponseData>> = [
    {
      id: 'request-inputs',
      type: NodeKind.REQUEST_INPUTS,
      position: { x: COL.inputs, y: ROW.middle },
      data: {
        kind: NodeKind.REQUEST_INPUTS,
        fields: [
          {
            id: 'text_field',
            label: 'text_field',
            type: 'text_field',
            value:
              'Product: Wireless Bluetooth Headphones. Features: Noise cancellation, 30-hour battery, foldable design.',
          },
          {
            id: 'image_field',
            label: 'image_field',
            type: 'image_field',
          },
        ],
      },
      deletable: false,
    },
    {
      id: 'gemini-1',
      type: NodeKind.GEMINI,
      position: { x: COL.mid1, y: ROW.top },
      data: {
        kind: NodeKind.GEMINI,
        model: SAMPLE_MODEL,
        systemPrompt:
          'You are a marketing copywriter. Write a one-paragraph product description.',
      },
    },
    {
      id: 'gemini-2',
      type: NodeKind.GEMINI,
      position: { x: COL.mid2, y: ROW.top },
      data: {
        kind: NodeKind.GEMINI,
        model: SAMPLE_MODEL,
        systemPrompt:
          'Condense the following product description into a tweet-length hook (under 240 characters).',
      },
    },
    {
      id: 'crop-1',
      type: NodeKind.CROP_IMAGE,
      position: { x: COL.mid1, y: ROW.bottom },
      data: {
        kind: NodeKind.CROP_IMAGE,
        xPct: 20,
        yPct: 20,
        wPct: 60,
        hPct: 60,
      },
    },
    {
      id: 'crop-2',
      type: NodeKind.CROP_IMAGE,
      position: { x: COL.mid2, y: ROW.bottom },
      data: {
        kind: NodeKind.CROP_IMAGE,
        xPct: 0,
        yPct: 0,
        wPct: 100,
        hPct: 50,
      },
    },
    {
      id: 'gemini-final',
      type: NodeKind.GEMINI,
      position: { x: COL.final, y: ROW.middle },
      data: {
        kind: NodeKind.GEMINI,
        model: SAMPLE_MODEL,
        systemPrompt:
          'You are a social media manager. Combine the tweet hook and the two product crops into a final marketing post.',
      },
    },
    {
      id: 'response',
      type: NodeKind.RESPONSE,
      position: { x: COL.response, y: ROW.middle + 60 },
      data: { kind: NodeKind.RESPONSE },
      deletable: false,
    },
  ]

  const edges: Edge[] = [
    // image_field → both crops (single source fans out)
    { id: 'e-img-crop1', source: 'request-inputs', sourceHandle: 'image_field', target: 'crop-1', targetHandle: 'input-image', type: 'animatedEdge' },
    { id: 'e-img-crop2', source: 'request-inputs', sourceHandle: 'image_field', target: 'crop-2', targetHandle: 'input-image', type: 'animatedEdge' },
    // text_field → Gemini #1 prompt
    { id: 'e-text-g1', source: 'request-inputs', sourceHandle: 'text_field', target: 'gemini-1', targetHandle: 'prompt', type: 'animatedEdge' },
    // Gemini #1 → Gemini #2 prompt
    { id: 'e-g1-g2', source: 'gemini-1', sourceHandle: 'response', target: 'gemini-2', targetHandle: 'prompt', type: 'animatedEdge' },
    // Gemini #2 → Final Gemini prompt
    { id: 'e-g2-final', source: 'gemini-2', sourceHandle: 'response', target: 'gemini-final', targetHandle: 'prompt', type: 'animatedEdge' },
    // Both crops → Final Gemini image-vision (multi-connection)
    { id: 'e-crop1-final', source: 'crop-1', sourceHandle: 'output-image', target: 'gemini-final', targetHandle: 'image-vision', type: 'animatedEdge' },
    { id: 'e-crop2-final', source: 'crop-2', sourceHandle: 'output-image', target: 'gemini-final', targetHandle: 'image-vision', type: 'animatedEdge' },
    // Final Gemini → Response
    { id: 'e-final-response', source: 'gemini-final', sourceHandle: 'response', target: 'response', targetHandle: 'result', type: 'animatedEdge' },
  ]

  return { nodes, edges }
}
