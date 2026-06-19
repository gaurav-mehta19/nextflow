'use client'

import { useState, useCallback } from 'react'
import {
  Search, Crop, Sparkles, Settings, LayoutGrid,
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
} from 'lucide-react'
import { useCanvasStore } from '../../lib/store/canvas.store'
import { NodeKind } from '../../lib/types/nodes'
import type { Node } from '@xyflow/react'
import type { NodeData, CropImageData, GeminiData } from '../../lib/types/nodes'
import { useUser } from '@clerk/nextjs'

interface SidebarItem {
  kind: NodeKind
  label: string
  description: string
  icon: React.ReactNode
  category: string
  defaultData: NodeData
}

const SIDEBAR_ITEMS: SidebarItem[] = [
  {
    kind: NodeKind.CROP_IMAGE,
    label: 'Crop Image',
    description: 'Crop an image via Transloadit',
    icon: <Crop size={15} className="text-blue-500" />,
    category: 'Image',
    defaultData: { kind: NodeKind.CROP_IMAGE, xPct: 0, yPct: 0, wPct: 100, hPct: 100 } as CropImageData,
  },
  {
    kind: NodeKind.GEMINI,
    label: 'Gemini 2.5 Flash',
    description: 'Google multimodal LLM',
    icon: <Sparkles size={15} className="text-purple-500" />,
    category: 'LLM',
    defaultData: { kind: NodeKind.GEMINI, systemPrompt: '', model: 'gemini-2.5-flash' } as GeminiData,
  },
]

const CATEGORIES = ['Image', 'LLM']

export function CanvasSidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const [search, setSearch] = useState('')
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    Image: true,
    LLM: true,
  })
  const addNode = useCanvasStore((s) => s.addNode)
  const { user } = useUser()

  const handleAdd = useCallback(
    (item: SidebarItem) => {
      const newNode: Node<NodeData> = {
        id: `${item.kind}-${Date.now()}`,
        type: item.kind,
        position: { x: 380 + Math.random() * 80 - 40, y: 200 + Math.random() * 80 - 40 },
        data: item.defaultData,
      }
      addNode(newNode)
    },
    [addNode]
  )

  const toggleSection = (section: string) =>
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }))

  const filtered = SIDEBAR_ITEMS.filter(
    (item) =>
      !search ||
      item.label.toLowerCase().includes(search.toLowerCase()) ||
      item.description.toLowerCase().includes(search.toLowerCase())
  )

  const initials =
    user?.firstName?.[0]?.toUpperCase() ??
    user?.emailAddresses?.[0]?.emailAddress?.[0]?.toUpperCase() ??
    'U'
  const displayName = user?.fullName ?? user?.emailAddresses?.[0]?.emailAddress ?? 'User'

  return (
    <div
      className={`flex flex-col h-full bg-white border-r border-gray-200 transition-all duration-200 flex-shrink-0 ${
        collapsed ? 'w-14' : 'w-56'
      }`}
    >
      <div
        className={`flex items-center px-3 py-3 border-b border-gray-200 ${
          collapsed ? 'justify-center' : 'justify-between'
        }`}
      >
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-indigo-600 flex items-center justify-center flex-shrink-0">
              <LayoutGrid size={11} className="text-white" />
            </div>
            <span className="text-xs font-semibold text-gray-700">NextFlow</span>
          </div>
        )}
        <button
          onClick={() => setCollapsed((p) => !p)}
          className="text-gray-400 hover:text-gray-700 transition-colors"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      {!collapsed && (
        <div className="px-2 pt-2 pb-1.5 border-b border-gray-100">
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5">
            <Search size={12} className="text-gray-400 flex-shrink-0" />
            <input
              className="flex-1 bg-transparent text-xs text-gray-700 outline-none placeholder-gray-400 min-w-0"
              placeholder="Quick search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      )}

      <div
        className={`flex items-center gap-2.5 px-3 py-2 cursor-default select-none ${
          collapsed ? 'justify-center' : ''
        }`}
        title={collapsed ? 'All Tools' : undefined}
      >
        <LayoutGrid size={14} className="text-gray-400 flex-shrink-0" />
        {!collapsed && (
          <>
            <span className="text-xs text-gray-600 flex-1">All Tools</span>
            <span className="text-[10px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full font-semibold leading-none">
              {SIDEBAR_ITEMS.length}
            </span>
          </>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {search ? (
          <div className="py-1">
            {filtered.length === 0 && !collapsed ? (
              <p className="text-[11px] text-gray-400 text-center py-6">No results</p>
            ) : (
              filtered.map((item) => (
                <button
                  key={item.kind}
                  onClick={() => handleAdd(item)}
                  title={item.label}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 transition-colors text-left group ${
                    collapsed ? 'justify-center' : ''
                  }`}
                >
                  <span className="flex-shrink-0">{item.icon}</span>
                  {!collapsed && (
                    <span className="text-xs text-gray-600 group-hover:text-gray-900 truncate transition-colors">
                      {item.label}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        ) : (
          CATEGORIES.map((cat) => {
            const items = SIDEBAR_ITEMS.filter((i) => i.category === cat)
            const isExpanded = expandedSections[cat] ?? true
            return (
              <div key={cat}>
                {!collapsed && (
                  <button
                    onClick={() => toggleSection(cat)}
                    className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-gray-50 transition-colors group"
                  >
                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest group-hover:text-gray-500">
                      {cat}
                    </span>
                    {isExpanded ? (
                      <ChevronDown size={10} className="text-gray-300" />
                    ) : (
                      <ChevronUp size={10} className="text-gray-300" />
                    )}
                  </button>
                )}
                {(collapsed || isExpanded) &&
                  items.map((item) => (
                    <button
                      key={item.kind}
                      onClick={() => handleAdd(item)}
                      title={item.label}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 transition-colors text-left group ${
                        collapsed ? 'justify-center' : ''
                      }`}
                    >
                      <span className="flex-shrink-0 group-hover:scale-110 transition-transform">
                        {item.icon}
                      </span>
                      {!collapsed && (
                        <div className="min-w-0">
                          <p className="text-xs text-gray-700 group-hover:text-gray-900 truncate transition-colors leading-tight">
                            {item.label}
                          </p>
                          <p className="text-[10px] text-gray-400 truncate leading-tight mt-0.5">
                            {item.description}
                          </p>
                        </div>
                      )}
                    </button>
                  ))}
              </div>
            )
          })
        )}
      </div>

      <div className="border-t border-gray-200">
        <button
          title="Settings"
          className={`w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-gray-50 transition-colors ${
            collapsed ? 'justify-center' : ''
          }`}
        >
          <Settings size={14} className="text-gray-400 flex-shrink-0" />
          {!collapsed && <span className="text-xs text-gray-500">Settings</span>}
        </button>

        <div
          className={`flex items-center gap-2.5 px-3 py-2.5 border-t border-gray-100 ${
            collapsed ? 'justify-center' : ''
          }`}
          title={collapsed ? displayName : undefined}
        >
          <div className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-white">
            {initials}
          </div>
          {!collapsed && (
            <p className="text-xs text-gray-600 truncate min-w-0">{displayName}</p>
          )}
        </div>
      </div>
    </div>
  )
}
