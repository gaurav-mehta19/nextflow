'use client'

import React, { memo, useCallback, useRef, useState } from 'react'
import { Position } from '@xyflow/react'
import { Plus, Trash2, Type, Image, Video, Music, FileText, Upload, Loader2, Hash } from 'lucide-react'
import { TypedHandle } from '../handles/TypedHandle'
import { HandleType } from '../../../lib/types/handles'
import { NodeKind, type RequestInputsData, type FieldDef, type FieldType } from '../../../lib/types/nodes'
import { uploadToTransloadit } from '../../../lib/transloadit-upload'

const FIELD_CONFIG: Record<FieldType, {
  icon: typeof Type
  iconColor: string
  hoverBorder: string
  hoverText: string
  handleType: HandleType
  accept: string
  uploadLabel: string
  shortLabel: string
}> = {
  text_field:   { icon: Type,     iconColor: 'text-orange-400', hoverBorder: 'hover:border-orange-400', hoverText: 'hover:text-orange-500', handleType: HandleType.TEXT,   accept: '',         uploadLabel: '',                shortLabel: 'Text' },
  number_field: { icon: Hash,     iconColor: 'text-pink-500',   hoverBorder: 'hover:border-pink-400',   hoverText: 'hover:text-pink-500',   handleType: HandleType.NUMBER, accept: '',         uploadLabel: '',                shortLabel: 'Number' },
  image_field:  { icon: Image,    iconColor: 'text-blue-400',   hoverBorder: 'hover:border-blue-400',   hoverText: 'hover:text-blue-500',   handleType: HandleType.IMAGE,  accept: 'image/*',  uploadLabel: 'Upload image',    shortLabel: 'Image' },
  video_field:  { icon: Video,    iconColor: 'text-purple-400', hoverBorder: 'hover:border-purple-400', hoverText: 'hover:text-purple-500', handleType: HandleType.VIDEO,  accept: 'video/*',  uploadLabel: 'Upload video',    shortLabel: 'Video' },
  audio_field:  { icon: Music,    iconColor: 'text-green-400',  hoverBorder: 'hover:border-green-400',  hoverText: 'hover:text-green-500',  handleType: HandleType.AUDIO,  accept: 'audio/*',  uploadLabel: 'Upload audio',    shortLabel: 'Audio' },
  file_field:   { icon: FileText, iconColor: 'text-gray-400',   hoverBorder: 'hover:border-gray-400',   hoverText: 'hover:text-gray-700',   handleType: HandleType.FILE,   accept: '*/*',      uploadLabel: 'Upload file',     shortLabel: 'File' },
}
import { useCanvasStore } from '../../../lib/store/canvas.store'
import { useRunStore } from '../../../lib/store/run.store'

function pruneEdgesForField(nodeId: string, fieldId: string) {
  const { edges, setEdges } = useCanvasStore.getState()
  setEdges(edges.filter((e) => !(e.source === nodeId && e.sourceHandle === fieldId)))
}

interface Props {
  id: string
  data: RequestInputsData
}

function RequestInputsNodeComponent({ id, data }: Props) {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData)
  const nodeStatus = useRunStore((s) => s.nodeStatuses[id])

  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const [uploadingFields, setUploadingFields] = useState<Record<string, boolean>>({})
  const [uploadErrors, setUploadErrors] = useState<Record<string, string | null>>({})

  const addField = useCallback(
    (type: FieldType) => {
      const labelMap: Record<FieldType, string> = {
        text_field: 'Text Field',
        number_field: 'number_field',
        image_field: 'Image Field',
        video_field: 'Video Field',
        audio_field: 'Audio Field',
        file_field: 'File Field',
      }

      const newField: FieldDef = {
        id: `${type}-${crypto.randomUUID()}`,
        label: labelMap[type],
        type,
      }
      updateNodeData(id, { fields: [...data.fields, newField] } as Partial<RequestInputsData>)
    },
    [id, data.fields, updateNodeData]
  )

  const removeField = useCallback(
    (fieldId: string) => {
      updateNodeData(id, { fields: data.fields.filter((f) => f.id !== fieldId) } as Partial<RequestInputsData>)
      pruneEdgesForField(id, fieldId)
    },
    [id, data.fields, updateNodeData]
  )

  const updateFieldLabel = useCallback(
    (fieldId: string, label: string) => {
      updateNodeData(id, {
        fields: data.fields.map((f) => (f.id === fieldId ? { ...f, label } : f)),
      } as Partial<RequestInputsData>)
    },
    [id, data.fields, updateNodeData]
  )

  const updateFieldValue = useCallback(
    (fieldId: string, value: string, fileName?: string) => {
      updateNodeData(id, {
        fields: data.fields.map((f) => (f.id === fieldId ? { ...f, value, ...(fileName ? { fileName } : {}) } : f)),
      } as Partial<RequestInputsData>)
    },
    [id, data.fields, updateNodeData]
  )

  const statusClass =
    nodeStatus?.status === 'RUNNING'
      ? 'node-running'
      : nodeStatus?.status === 'SUCCESS'
      ? 'node-success'
      : nodeStatus?.status === 'FAILED'
      ? 'node-failed'
      : ''

  return (
    <div className={`node-base ${statusClass}`}>
      <div className="node-header bg-gradient-to-r from-indigo-50 to-blue-50/40 border-b border-indigo-100/60">
        <span className="text-[11px] font-semibold text-indigo-700 uppercase tracking-[0.08em]">
          Request Inputs
        </span>
        {nodeStatus?.status === 'SUCCESS' && (
          <span className="ml-auto text-[10px] font-medium tracking-wide uppercase bg-green-500 text-white px-2 py-0.5 rounded-full">Done</span>
        )}
        {nodeStatus?.status === 'FAILED' && (
          <span className="ml-auto text-[10px] font-medium tracking-wide uppercase bg-red-500 text-white px-2 py-0.5 rounded-full">Failed</span>
        )}
      </div>

      <div className="p-4 space-y-4">
        {data.fields.map((field) => {
          const cfg = FIELD_CONFIG[field.type]
          const Icon = cfg.icon
          return (
            <div key={field.id} className="relative">
              <div className="flex items-center gap-2 mb-1.5">
                <Icon size={13} className={`${cfg.iconColor} flex-shrink-0`} />
                <input
                  className="flex-1 bg-transparent text-sm text-gray-700 border-0 outline-none placeholder-gray-400 font-medium"
                  value={field.label}
                  onChange={(e) => updateFieldLabel(field.id, e.target.value)}
                  placeholder="Field name"
                />
                <button
                  onClick={() => removeField(field.id)}
                  className="text-gray-400 hover:text-red-400 transition-colors"
                >
                  <Trash2 size={12} />
                </button>
              </div>

              {field.type === 'text_field' ? (
                <textarea
                  className="w-full bg-gray-50 text-sm text-gray-700 rounded-lg p-2.5 resize-none border border-gray-200 focus:border-purple-400 outline-none"
                  rows={3}
                  placeholder="Enter text..."
                  value={field.value ?? ''}
                  onChange={(e) => updateFieldValue(field.id, e.target.value)}
                />
              ) : field.type === 'number_field' ? (
                <input
                  type="number"
                  inputMode="decimal"
                  className="w-full bg-gray-50 text-sm text-gray-700 rounded-lg px-3 py-2 border border-gray-200 focus:border-pink-400 outline-none"
                  placeholder="0"
                  value={field.value ?? ''}
                  onChange={(e) => updateFieldValue(field.id, e.target.value)}
                />
              ) : (
                <div
                  className={`w-full bg-gray-50 border border-dashed border-gray-300 rounded-lg p-3 text-center ${
                    uploadingFields[field.id] ? 'cursor-wait' : 'cursor-pointer'
                  } ${cfg.hoverBorder} transition-colors`}
                  onClick={() => {
                    if (uploadingFields[field.id]) return
                    fileInputRefs.current[field.id]?.click()
                  }}
                >
                  <input
                    ref={(el) => { fileInputRefs.current[field.id] = el }}
                    type="file"
                    accept={cfg.accept}
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      e.target.value = ''
                      if (!file) return
                      setUploadingFields((p) => ({ ...p, [field.id]: true }))
                      setUploadErrors((p) => ({ ...p, [field.id]: null }))
                      uploadToTransloadit(file)
                        .then((url) => updateFieldValue(field.id, url, file.name))
                        .catch((err: Error) =>
                          setUploadErrors((p) => ({ ...p, [field.id]: err.message }))
                        )
                        .finally(() =>
                          setUploadingFields((p) => ({ ...p, [field.id]: false }))
                        )
                    }}
                  />
                  {uploadingFields[field.id] ? (
                    <div className="flex items-center justify-center gap-2 text-sm text-gray-500 py-1">
                      <Loader2 size={14} className="animate-spin" />
                      Uploading…
                    </div>
                  ) : field.value ? (
                    field.type === 'image_field' ? (

                      <img src={field.value} alt="preview" className="max-h-28 mx-auto rounded object-contain" />
                    ) : (
                      <div className="flex items-center justify-center gap-2 text-sm text-gray-600 py-1">
                        <Icon size={14} className={cfg.iconColor} />
                        <span className="truncate max-w-[180px]">{field.fileName ?? 'Uploaded'}</span>
                      </div>
                    )
                  ) : (
                    <div className="flex items-center justify-center gap-1.5 text-sm text-gray-400 py-1">
                      <Upload size={12} />
                      {cfg.uploadLabel}
                    </div>
                  )}
                  {uploadErrors[field.id] && (
                    <p className="text-[10px] text-red-500 mt-1.5 break-words">{uploadErrors[field.id]}</p>
                  )}
                </div>
              )}

              <div className="absolute -right-3 top-1/2 -translate-y-1/2">
                <TypedHandle
                  id={field.id}
                  type="source"
                  position={Position.Right}
                  handleType={cfg.handleType}
                  label={field.label}
                />
              </div>
            </div>
          )
        })}

        <div className="grid grid-cols-3 gap-1.5 mt-2">
          {(Object.keys(FIELD_CONFIG) as FieldType[]).map((type) => {
            const cfg = FIELD_CONFIG[type]
            const Icon = cfg.icon
            return (
              <button
                key={type}
                onClick={() => addField(type)}
                className={`flex flex-col items-center justify-center gap-0.5 text-[10px] text-gray-500 ${cfg.hoverText} border border-dashed border-gray-200 ${cfg.hoverBorder} rounded-lg py-2 px-1 transition-colors`}
                title={`Add ${cfg.shortLabel}`}
              >
                <Icon size={13} />
                {cfg.shortLabel}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export const RequestInputsNode = memo(RequestInputsNodeComponent)
RequestInputsNode.displayName = 'RequestInputsNode'
