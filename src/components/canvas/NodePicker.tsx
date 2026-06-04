'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useReactFlow } from '@xyflow/react'
import { Search, X, Crop, Sparkles, Image as ImageIcon, Video, Music, Layers } from 'lucide-react'
import type { Node } from '@xyflow/react'
import { useCanvasStore } from '../../lib/store/canvas.store'
import { NodeKind } from '../../lib/types/nodes'
import type { NodeData, CropImageData, GeminiData } from '../../lib/types/nodes'

type Category = 'Recent' | 'Image' | 'Video' | 'Audio' | 'Others'

interface PickerItem {
  kind: NodeKind
  label: string
  description: string
  icon: React.ReactNode
  category: Category
  available: boolean
  defaultData: () => NodeData
}

const ITEMS: PickerItem[] = [
  {
    kind: NodeKind.CROP_IMAGE,
    label: 'Crop Image',
    description: 'Crop an image to a specific region via FFmpeg (Transloadit)',
    icon: <Crop size={16} className="text-blue-500" />,
    category: 'Image',
    available: true,
    defaultData: (): CropImageData => ({
      kind: NodeKind.CROP_IMAGE,
      xPct: 0,
      yPct: 0,
      wPct: 100,
      hPct: 100,
    }),
  },
  {
    kind: NodeKind.GEMINI,
    label: 'Gemini 2.5 Pro',
    description: 'Google multimodal LLM with vision, text, audio, video',
    icon: <Sparkles size={16} className="text-purple-500" />,
    category: 'Others',
    available: true,
    defaultData: (): GeminiData => ({
      kind: NodeKind.GEMINI,
      model: 'gemini-2.5-pro',
      systemPrompt: '',
    }),
  },
]

const CATEGORIES: Category[] = ['Recent', 'Image', 'Video', 'Audio', 'Others']

const CATEGORY_ICONS: Record<Category, React.ReactNode> = {
  Recent: <Layers size={13} />,
  Image: <ImageIcon size={13} />,
  Video: <Video size={13} />,
  Audio: <Music size={13} />,
  Others: <Sparkles size={13} />,
}

interface NodePickerProps {
  open: boolean
  onClose: () => void
}

export function NodePicker({ open, onClose }: NodePickerProps) {
  const addNode = useCanvasStore((s) => s.addNode)
  const { screenToFlowPosition } = useReactFlow()
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<Category>('Recent')
  const [recent, setRecent] = useState<NodeKind[]>([])
  const searchRef = useRef<HTMLInputElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      setSearch('')
      setTimeout(() => searchRef.current?.focus(), 50)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const click = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Element)) onClose()
    }
    window.addEventListener('keydown', handler)
    // Slight delay so the click that opened us doesn't immediately close it
    const t = setTimeout(() => window.addEventListener('mousedown', click), 0)
    return () => {
      clearTimeout(t)
      window.removeEventListener('keydown', handler)
      window.removeEventListener('mousedown', click)
    }
  }, [open, onClose])

  const handleAdd = (item: PickerItem) => {
    if (!item.available) return
    const viewportCenter = screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    })
    const node: Node<NodeData> = {
      id: `${item.kind}-${crypto.randomUUID()}`,
      type: item.kind,
      position: {
        x: viewportCenter.x + (Math.random() * 80 - 40),
        y: viewportCenter.y + (Math.random() * 80 - 40),
      },
      data: item.defaultData(),
    }
    addNode(node)
    setRecent((prev) => [item.kind, ...prev.filter((k) => k !== item.kind)].slice(0, 6))
    onClose()
  }

  const filtered = useMemo(() => {
    if (search.trim()) {
      const q = search.toLowerCase()
      return ITEMS.filter(
        (i) => i.label.toLowerCase().includes(q) || i.description.toLowerCase().includes(q)
      )
    }
    if (activeCategory === 'Recent') {
      if (recent.length === 0) return ITEMS
      return recent
        .map((kind) => ITEMS.find((i) => i.kind === kind))
        .filter((i): i is PickerItem => i !== undefined)
    }
    return ITEMS.filter((i) => i.category === activeCategory)
  }, [search, activeCategory, recent])

  if (!open) return null

  return (
    <div
      ref={popoverRef}
      className="absolute bottom-20 left-1/2 -translate-x-1/2 z-50 w-[420px] bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden"
    >
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100">
        <Search size={14} className="text-gray-400 flex-shrink-0" />
        <input
          ref={searchRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search nodes..."
          className="flex-1 bg-transparent text-sm text-gray-700 outline-none placeholder-gray-400"
        />
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-700 transition-colors flex-shrink-0"
          title="Close"
        >
          <X size={14} />
        </button>
      </div>

      {!search.trim() && (
        <div className="flex items-center gap-1 px-2 py-2 border-b border-gray-100 overflow-x-auto">
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 font-medium'
                    : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                }`}
              >
                {CATEGORY_ICONS[cat]}
                {cat}
              </button>
            )
          })}
        </div>
      )}

      <div className="max-h-[280px] overflow-y-auto py-1">
        {filtered.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-gray-400">No nodes found</div>
        ) : (
          filtered.map((item) => (
            <button
              key={item.kind}
              onClick={() => handleAdd(item)}
              disabled={!item.available}
              className={`w-full flex items-start gap-3 px-3 py-2.5 hover:bg-gray-50 transition-colors text-left ${
                !item.available ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                {item.icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-800">{item.label}</p>
                  {!item.available && (
                    <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                      Coming soon
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5 leading-snug">{item.description}</p>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
