'use client'

import Link from 'next/link'
import { Workflow, ChevronLeft, ChevronRight } from 'lucide-react'

interface Props {
  collapsed: boolean
  onToggle: () => void
}

function LogoMark() {
  return (
    <Link
      href="/dashboard"
      aria-label="NextFlow home"
      className="flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500 to-violet-500 text-white shadow-sm"
    >
      <Workflow size={18} strokeWidth={2.25} />
    </Link>
  )
}

function Logo() {
  return (
    <Link href="/dashboard" className="flex items-center gap-1.5 group/logo">
      <span className="flex items-center justify-center w-7 h-7 rounded-md bg-gradient-to-br from-purple-500 to-violet-500 text-white shadow-sm">
        <Workflow size={16} strokeWidth={2.25} />
      </span>
      <span className="text-[19px] font-semibold tracking-tight text-gray-900">
        NextFlow
      </span>
    </Link>
  )
}

export function SidebarHeader({ collapsed, onToggle }: Props) {
  return (
    <div className={`flex items-center h-[60px] px-3 ${collapsed ? 'justify-center' : 'pl-4 pr-3'}`}>
      {collapsed ? <LogoMark /> : <Logo />}
      <button
        onClick={onToggle}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className="absolute top-5 -right-3.5 z-40 flex items-center justify-center w-7 h-7 rounded-full bg-white border border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors"
        style={{ boxShadow: '0 2px 6px rgba(15,23,42,0.08), 0 8px 24px rgba(15,23,42,0.10)' }}
      >
        {collapsed
          ? <ChevronRight size={14} strokeWidth={2.25} />
          : <ChevronLeft size={14} strokeWidth={2.25} />}
      </button>
    </div>
  )
}
