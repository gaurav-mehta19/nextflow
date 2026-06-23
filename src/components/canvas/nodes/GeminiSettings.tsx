'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

interface Props {
  temperature: number
  maxTokens: number
  onTemperatureChange: (value: number) => void
  onMaxTokensChange: (value: number) => void
}

export function GeminiSettings({ temperature, maxTokens, onTemperatureChange, onMaxTokensChange }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen((p) => !p)}
        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors"
      >
        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        Settings
      </button>

      {open && (
        <div className="space-y-2.5 pl-2">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Temperature</label>
            <div className="flex items-center gap-2">
              <input
                type="range" min={0} max={2} step={0.1}
                value={temperature}
                onChange={(e) => onTemperatureChange(Number(e.target.value))}
                className="flex-1 h-1 accent-purple-500"
              />
              <span className="text-sm text-gray-500 w-8">{temperature.toFixed(1)}</span>
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Max Tokens</label>
            <input
              type="number" min={1} max={8192}
              value={maxTokens}
              onChange={(e) => onMaxTokensChange(Number(e.target.value))}
              className="w-full bg-gray-50 text-sm text-gray-700 rounded-lg p-2 border border-gray-200 outline-none focus:border-purple-400"
            />
          </div>
        </div>
      )}
    </>
  )
}
