'use client'

import { Position } from '@xyflow/react'
import { TypedHandle } from '../handles/TypedHandle'
import { HandleType } from '../../../lib/types/handles'

interface Props {
  handleId: string
  label: string
  rows: number
  connected: boolean
  value: string
  placeholder: string
  onChange: (value: string) => void
}

export function HandleTextarea({ handleId, label, rows, connected, value, placeholder, onChange }: Props) {
  return (
    <div className="relative">
      <div className="absolute -left-3 top-3">
        <TypedHandle id={handleId} type="target" position={Position.Left} handleType={HandleType.TEXT} label={label} connected={connected} />
      </div>
      <label className="block text-xs text-gray-400 mb-1.5 ml-3">{label}</label>
      <textarea
        className={`w-full text-sm rounded-lg p-2.5 resize-none border outline-none ${
          connected
            ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
            : 'bg-gray-50 text-gray-700 border-gray-200 focus:border-purple-400'
        }`}
        rows={rows}
        placeholder={connected ? '' : placeholder}
        readOnly={connected}
        disabled={connected}
        value={connected ? '' : value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}
