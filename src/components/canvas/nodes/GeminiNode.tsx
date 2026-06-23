'use client'

import { memo, useCallback } from 'react'
import { Position } from '@xyflow/react'
import { Sparkles } from 'lucide-react'
import { TypedHandle } from '../handles/TypedHandle'
import { HandleType } from '../../../lib/types/handles'
import type { GeminiData } from '../../../lib/types/nodes'
import { useCanvasStore } from '../../../lib/store/canvas.store'
import { useRunStore } from '../../../lib/store/run.store'
import { ResponseWithImages } from '../ResponseWithImages'
import { MediaRow } from './MediaRow'
import { HandleTextarea } from './HandleTextarea'
import { GeminiSettings } from './GeminiSettings'
import { NodeStatusBadge } from './NodeStatusBadge'

const GEMINI_MODELS = [{ value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' }]

interface Props {
  id: string
  data: GeminiData
}

function GeminiNodeComponent({ id, data }: Props) {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData)
  const edges = useCanvasStore((s) => s.edges)
  const nodeStatus = useRunStore((s) => s.nodeStatuses[id])

  const promptConnected = edges.some((e) => e.target === id && e.targetHandle === 'prompt')
  const systemPromptConnected = edges.some((e) => e.target === id && e.targetHandle === 'system-prompt')
  const imageVisionConnected = edges.some((e) => e.target === id && e.targetHandle?.startsWith('image-vision'))

  const update = useCallback(
    <K extends keyof GeminiData>(key: K, value: GeminiData[K]) => {
      updateNodeData(id, { [key]: value } as Partial<GeminiData>)
    },
    [id, updateNodeData]
  )

  const statusClass =
    nodeStatus?.status === 'RUNNING' ? 'node-running'
    : nodeStatus?.status === 'SUCCESS' ? 'node-success'
    : nodeStatus?.status === 'FAILED' ? 'node-failed'
    : ''

  const outputData = nodeStatus?.outputData as Record<string, unknown> | undefined

  return (
    <div className={`node-base ${statusClass}`}>
      <div className="node-header bg-gradient-to-r from-purple-50 to-fuchsia-50/40 border-b border-purple-100/60">
        <div className="w-6 h-6 rounded-lg bg-white border border-purple-100 flex items-center justify-center flex-shrink-0">
          <Sparkles size={13} className="text-purple-500" />
        </div>
        <select
          value={data.model}
          onChange={(e) => update('model', e.target.value)}
          className="bg-transparent text-sm font-semibold text-purple-800 border-0 outline-none cursor-pointer pr-1"
          onClick={(e) => e.stopPropagation()}
        >
          {GEMINI_MODELS.map((m) => (
            <option key={m.value} value={m.value} className="bg-white text-gray-800">{m.label}</option>
          ))}
        </select>
        <NodeStatusBadge status={nodeStatus?.status} />
      </div>

      <div className="p-4 space-y-4">
        <HandleTextarea
          handleId="prompt" label="Prompt" rows={3} connected={promptConnected}
          value={data.prompt ?? ''} placeholder="Enter prompt…"
          onChange={(v) => update('prompt', v)}
        />
        <HandleTextarea
          handleId="system-prompt" label="System Prompt" rows={2} connected={systemPromptConnected}
          value={data.systemPrompt ?? ''} placeholder="System instructions…"
          onChange={(v) => update('systemPrompt', v)}
        />

        <MediaRow
          handleId="image-vision" handleType={HandleType.IMAGE}
          label="Image (Vision)" connected={imageVisionConnected}
          accept="image/*" uploadLabel="Upload Image"
          value={data.imageUrl}
          onClear={() => update('imageUrl', undefined)}
          onUpload={(url) => update('imageUrl', url)}
        />
        <MediaRow
          handleId="video" handleType={HandleType.VIDEO}
          label="Video" connected={false}
          accept="video/*" uploadLabel="Upload Video"
          value={data.videoUrl} fileName={data.videoFileName}
          onClear={() => { update('videoUrl', undefined); update('videoFileName', undefined) }}
          onUpload={(url, name) => { update('videoUrl', url); update('videoFileName', name) }}
        />
        <MediaRow
          handleId="audio" handleType={HandleType.AUDIO}
          label="Audio" connected={false}
          accept="audio/*" uploadLabel="Upload Audio"
          value={data.audioUrl} fileName={data.audioFileName}
          onClear={() => { update('audioUrl', undefined); update('audioFileName', undefined) }}
          onUpload={(url, name) => { update('audioUrl', url); update('audioFileName', name) }}
        />
        <MediaRow
          handleId="file" handleType={HandleType.FILE}
          label="File" connected={false}
          accept="*/*" uploadLabel="Upload File"
          value={data.fileUrl} fileName={data.fileName}
          onClear={() => { update('fileUrl', undefined); update('fileName', undefined) }}
          onUpload={(url, name) => { update('fileUrl', url); update('fileName', name) }}
        />

        <GeminiSettings
          temperature={data.temperature ?? 1}
          maxTokens={data.maxTokens ?? 1024}
          onTemperatureChange={(v) => update('temperature', v)}
          onMaxTokensChange={(v) => update('maxTokens', v)}
        />

        <div className="relative pt-3 border-t border-gray-100">
          <label className="block text-xs text-gray-400 mb-1.5">Response</label>
          <div className="nowheel bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-sm max-h-[480px] node-scroll min-h-[64px]">
            {typeof outputData?.response === 'string' && outputData.response ? (
              <ResponseWithImages
                text={outputData.response as string}
                imageUrls={Array.isArray(outputData?.imageUrls) ? (outputData.imageUrls as string[]) : []}
              />
            ) : (
              <span className="text-gray-400 italic text-xs">No output yet</span>
            )}
          </div>
          <div className="absolute -right-3 top-1/2 -translate-y-1/2 mt-3">
            <TypedHandle id="response" type="source" position={Position.Right} handleType={HandleType.TEXT} />
          </div>
        </div>
      </div>
    </div>
  )
}

export const GeminiNode = memo(GeminiNodeComponent)
GeminiNode.displayName = 'GeminiNode'
