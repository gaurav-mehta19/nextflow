'use client'

import { useRef, useState } from 'react'
import { Position } from '@xyflow/react'
import { Upload, X, Loader2 } from 'lucide-react'
import { TypedHandle } from '../handles/TypedHandle'
import { HandleType } from '../../../lib/types/handles'
import { uploadToTransloadit } from '../../../lib/transloadit-upload'

export interface MediaRowProps {
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

export function MediaRow({
  handleId, handleType, label, connected, accept, uploadLabel,
  value, fileName, onUpload, onClear,
}: MediaRowProps) {
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
