'use client'

import React, { memo, useCallback, useRef, useState } from 'react'
import { Position } from '@xyflow/react'
import { Sparkles, ChevronDown, ChevronRight, Upload, X, Loader2 } from 'lucide-react'
import { TypedHandle } from '../handles/TypedHandle'
import { HandleType } from '../../../lib/types/handles'
import type { GeminiData } from '../../../lib/types/nodes'
import { useCanvasStore } from '../../../lib/store/canvas.store'
import { useRunStore } from '../../../lib/store/run.store'
import { uploadToTransloadit } from '../../../lib/transloadit-upload'

interface MediaRowProps {
  handleId: string
  handleType: HandleType
  label: string
  connected: boolean
  accept: string
  uploadLabel: string
  value?: string
  fileName?: string
  onUpload: (url: string, fileName?: string) => void
  onClear: () => void
}

function MediaRow({ handleId, handleType, label, connected, accept, uploadLabel, value, fileName, onUpload, onClear }: MediaRowProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const hasValue = !!value
  const display = uploading ? 'Uploading…' : (fileName ?? (hasValue ? 'Uploaded' : uploadLabel))

  return (
    <div className="relative">
      <div className="absolute -left-3 top-1/2 -translate-y-1/2">
        <TypedHandle id={handleId} type="target" position={Position.Left} handleType={handleType} label={label} connected={connected} />
      </div>
      <div className="ml-4 flex items-center gap-2">
        <span className="text-xs text-gray-500 w-24 flex-shrink-0">{label}</span>
        {connected ? (
          <button
            disabled
            className="flex-1 flex items-center justify-center gap-1.5 text-xs text-gray-400 bg-gray-100 border border-gray-200 rounded-lg py-1.5 px-2 truncate cursor-not-allowed"
            title={uploadLabel}
          >
            <Upload size={11} className="flex-shrink-0" />
            <span className="truncate">{uploadLabel}</span>
          </button>
        ) : (
          <>
            <input
              ref={inputRef}
              type="file"
              accept={accept}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (!file) return
                setUploading(true)
                setError(null)
                uploadToTransloadit(file)
                  .then((url) => onUpload(url, file.name))
                  .catch((err: Error) => setError(err.message))
                  .finally(() => setUploading(false))
              }}
            />
            <button
              onClick={() => { if (!uploading) inputRef.current?.click() }}
              disabled={uploading}
              className={`flex-1 flex items-center justify-center gap-1.5 text-xs ${hasValue ? 'text-purple-600 bg-purple-50 border-purple-200 hover:bg-purple-100' : 'text-gray-600 bg-gray-50 border-gray-200 hover:bg-gray-100'} border rounded-lg py-1.5 px-2 transition-colors truncate ${uploading ? 'opacity-60 cursor-wait' : ''}`}
              title={display}
            >
              {uploading
                ? <Loader2 size={11} className="flex-shrink-0 animate-spin" />
                : <Upload size={11} className="flex-shrink-0" />}
              <span className="truncate">{display}</span>
            </button>
            {hasValue && !uploading && (
              <button
                onClick={onClear}
                className="flex-shrink-0 w-7 h-7 flex items-center justify-center text-gray-400 hover:text-red-500 border border-gray-200 hover:border-red-200 rounded-lg transition-colors"
                title="Clear"
              >
                <X size={12} />
              </button>
            )}
          </>
        )}
      </div>
      {error && (
        <p className="ml-4 mt-1 text-[10px] text-red-500 break-words">{error}</p>
      )}
    </div>
  )
}

const GEMINI_MODELS = [
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
]

interface Props {
  id: string
  data: GeminiData
}

interface ConnectedHandles {
  prompt?: boolean
  systemPrompt?: boolean
  imageVision?: boolean
}

function GeminiNodeComponent({ id, data }: Props) {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData)
  const edges = useCanvasStore((s) => s.edges)
  const nodeStatus = useRunStore((s) => s.nodeStatuses[id])

  const [settingsOpen, setSettingsOpen] = useState(false)

  const connectedHandles: ConnectedHandles = {
    prompt: edges.some((e) => e.target === id && e.targetHandle === 'prompt'),
    systemPrompt: edges.some((e) => e.target === id && e.targetHandle === 'system-prompt'),
    imageVision: edges.some((e) => e.target === id && e.targetHandle?.startsWith('image-vision')),
  }

  const update = useCallback(
    <K extends keyof GeminiData>(key: K, value: GeminiData[K]) => {
      updateNodeData(id, { [key]: value } as Partial<GeminiData>)
    },
    [id, updateNodeData]
  )

  const statusClass =
    nodeStatus?.status === 'RUNNING'
      ? 'node-running'
      : nodeStatus?.status === 'SUCCESS'
      ? 'node-success'
      : nodeStatus?.status === 'FAILED'
      ? 'node-failed'
      : ''

  const outputData = nodeStatus?.outputData as Record<string, unknown> | undefined

  return (
    <div className={`node-base ${statusClass}`}>
      <div className="node-header bg-purple-50 border-b border-purple-100">
        <Sparkles size={14} className="text-purple-500" />
        <select
          value={data.model}
          onChange={(e) => update('model', e.target.value)}
          className="ml-1 bg-transparent text-sm font-semibold text-purple-700 border-0 outline-none cursor-pointer"
          onClick={(e) => e.stopPropagation()}
        >
          {GEMINI_MODELS.map((m) => (
            <option key={m.value} value={m.value} className="bg-white text-gray-800">
              {m.label}
            </option>
          ))}
        </select>
        {nodeStatus?.status === 'RUNNING' && (
          <span className="ml-auto text-xs bg-indigo-500 text-white px-2 py-0.5 rounded-full animate-pulse">
            Running…
          </span>
        )}
        {nodeStatus?.status === 'SUCCESS' && (
          <span className="ml-auto text-xs bg-green-500 text-white px-2 py-0.5 rounded-full">Done</span>
        )}
        {nodeStatus?.status === 'FAILED' && (
          <span className="ml-auto text-xs bg-red-500 text-white px-2 py-0.5 rounded-full">Failed</span>
        )}
      </div>

      <div className="p-4 space-y-3">
        {/* Prompt */}
        <div className="relative">
          <div className="absolute -left-3 top-3">
            <TypedHandle id="prompt" type="target" position={Position.Left} handleType={HandleType.TEXT} label="Prompt" connected={connectedHandles.prompt} />
          </div>
          <label className="block text-xs text-gray-400 mb-1.5 ml-3">Prompt</label>
          <textarea
            className={`w-full text-sm rounded-lg p-2.5 resize-none border outline-none ${
              connectedHandles.prompt
                ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                : 'bg-gray-50 text-gray-700 border-gray-200 focus:border-purple-400'
            }`}
            rows={3}
            placeholder={connectedHandles.prompt ? '' : 'Enter prompt…'}
            readOnly={connectedHandles.prompt}
            disabled={connectedHandles.prompt}
            value={connectedHandles.prompt ? '' : (data.prompt ?? '')}
            onChange={(e) => update('prompt', e.target.value)}
          />
        </div>

        {/* System Prompt */}
        <div className="relative">
          <div className="absolute -left-3 top-3">
            <TypedHandle id="system-prompt" type="target" position={Position.Left} handleType={HandleType.TEXT} label="System Prompt" connected={connectedHandles.systemPrompt} />
          </div>
          <label className="block text-xs text-gray-400 mb-1.5 ml-3">System Prompt</label>
          <textarea
            className={`w-full text-sm rounded-lg p-2.5 resize-none border outline-none ${
              connectedHandles.systemPrompt
                ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                : 'bg-gray-50 text-gray-700 border-gray-200 focus:border-purple-400'
            }`}
            rows={2}
            value={connectedHandles.systemPrompt ? '' : data.systemPrompt}
            placeholder={connectedHandles.systemPrompt ? '' : 'System instructions…'}
            readOnly={connectedHandles.systemPrompt}
            disabled={connectedHandles.systemPrompt}
            onChange={(e) => update('systemPrompt', e.target.value)}
          />
        </div>

        <MediaRow
          handleId="image-vision"
          handleType={HandleType.IMAGE}
          label="Image (Vision)"
          connected={!!connectedHandles.imageVision}
          accept="image/*"
          uploadLabel="Upload Image"
          value={data.imageUrl}
          onClear={() => update('imageUrl', undefined)}
          onUpload={(url) => update('imageUrl', url)}
        />

        <MediaRow
          handleId="video"
          handleType={HandleType.VIDEO}
          label="Video"
          connected={false}
          accept="video/*"
          uploadLabel="Upload Video"
          value={data.videoUrl}
          fileName={data.videoFileName}
          onClear={() => { update('videoUrl', undefined); update('videoFileName', undefined) }}
          onUpload={(url, name) => { update('videoUrl', url); update('videoFileName', name) }}
        />

        <MediaRow
          handleId="audio"
          handleType={HandleType.AUDIO}
          label="Audio"
          connected={false}
          accept="audio/*"
          uploadLabel="Upload Audio"
          value={data.audioUrl}
          fileName={data.audioFileName}
          onClear={() => { update('audioUrl', undefined); update('audioFileName', undefined) }}
          onUpload={(url, name) => { update('audioUrl', url); update('audioFileName', name) }}
        />

        <MediaRow
          handleId="file"
          handleType={HandleType.FILE}
          label="File"
          connected={false}
          accept="*/*"
          uploadLabel="Upload File"
          value={data.fileUrl}
          fileName={data.fileName}
          onClear={() => { update('fileUrl', undefined); update('fileName', undefined) }}
          onUpload={(url, name) => { update('fileUrl', url); update('fileName', name) }}
        />

        {/* Settings */}
        <button
          onClick={() => setSettingsOpen((p) => !p)}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors"
        >
          {settingsOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          Settings
        </button>

        {settingsOpen && (
          <div className="space-y-2.5 pl-2">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Temperature</label>
              <div className="flex items-center gap-2">
                <input
                  type="range" min={0} max={2} step={0.1}
                  value={data.temperature ?? 1}
                  onChange={(e) => update('temperature', Number(e.target.value))}
                  className="flex-1 h-1 accent-purple-500"
                />
                <span className="text-sm text-gray-500 w-8">{(data.temperature ?? 1).toFixed(1)}</span>
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Max Tokens</label>
              <input
                type="number" min={1} max={8192}
                value={data.maxTokens ?? 1024}
                onChange={(e) => update('maxTokens', Number(e.target.value))}
                className="w-full bg-gray-50 text-sm text-gray-700 rounded-lg p-2 border border-gray-200 outline-none focus:border-purple-400"
              />
            </div>
          </div>
        )}

        {/* Response section — always visible, fills after run */}
        <div className="relative pt-3 border-t border-gray-100">
          <label className="block text-xs text-gray-400 mb-1.5">Response</label>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-sm max-h-56 node-scroll whitespace-pre-wrap break-words min-h-[64px]">
            {typeof outputData?.response === 'string' && outputData.response ? (
              <span className="text-gray-700">{outputData.response as string}</span>
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
