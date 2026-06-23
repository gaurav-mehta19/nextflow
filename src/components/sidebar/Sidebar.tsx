'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import {
  Plus, Search, MessageSquare, Folder, Library, Workflow, Boxes, BookOpen,
  type LucideIcon,
} from 'lucide-react'
import { useSidebarStore } from '../../lib/store/sidebar.store'
import { SidebarHeader } from './SidebarHeader'
import { SidebarFooter } from './SidebarFooter'

interface NavItem {
  href: string
  label: string
  icon: LucideIcon
}

const TOP_ACTIONS: NavItem[] = [
  { href: '/dashboard?new=1', label: 'New task', icon: Plus },
  { href: '/dashboard?search=1', label: 'Search tasks', icon: Search },
]

const SECTIONS: NavItem[] = [
  { href: '/tasks', label: 'Tasks', icon: MessageSquare },
  { href: '/projects', label: 'Projects', icon: Folder },
  { href: '/library', label: 'Library', icon: Library },
  { href: '/dashboard', label: 'Flow', icon: Workflow },
  { href: '/nodes', label: 'Nodes', icon: Boxes },
  { href: '/api-mcp', label: 'API / MCP', icon: BookOpen },
]

const EXPANDED_WIDTH = 'w-[264px]'
const COLLAPSED_WIDTH = 'w-[68px]'

export function Sidebar() {
  const collapsed = useSidebarStore((s) => s.collapsed)
  const toggle = useSidebarStore((s) => s.toggle)
  const pathname = usePathname()
  const { user } = useUser()

  useEffect(() => {
    void useSidebarStore.persist.rehydrate()
  }, [])

  const isActive = (href: string) => pathname === href.split('?')[0]

  return (
    <aside
      aria-label="Primary navigation"
      data-collapsed={collapsed}
      className={`group/sidebar sticky top-0 h-screen shrink-0 z-30 flex flex-col border-r border-gray-200 bg-[#fafafa] transition-[width] duration-200 ease-out ${
        collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH
      }`}
    >
      <SidebarHeader collapsed={collapsed} onToggle={toggle} />

      <nav className="flex flex-col gap-0.5 px-2 pt-2" aria-label="Main">
        {TOP_ACTIONS.map((item) => (
          <NavLink key={item.href} item={item} collapsed={collapsed} active={false} />
        ))}
      </nav>

      <nav className="flex flex-col gap-0.5 px-2 pt-4" aria-label="Workspace">
        {SECTIONS.map((item) => (
          <NavLink key={item.href} item={item} collapsed={collapsed} active={isActive(item.href)} />
        ))}
      </nav>

      {collapsed ? (
        <div className="flex-1" aria-hidden />
      ) : (
        <div className="flex-1 flex items-center justify-center px-4">
          <p className="text-sm text-gray-500">No tasks yet</p>
        </div>
      )}

      <SidebarFooter collapsed={collapsed} userName={user?.fullName ?? user?.firstName ?? null} />
    </aside>
  )
}

interface NavLinkProps {
  item: NavItem
  collapsed: boolean
  active: boolean
}

function NavLink({ item, collapsed, active }: NavLinkProps) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      aria-current={active ? 'page' : undefined}
      className={`flex items-center gap-3 h-10 rounded-lg transition-colors ${
        collapsed ? 'justify-center px-0' : 'px-3'
      } ${
        active
          ? 'bg-gray-200/70 text-gray-900'
          : 'text-gray-700 hover:bg-gray-200/60 hover:text-gray-900'
      }`}
    >
      <Icon size={20} strokeWidth={1.75} className="shrink-0" />
      {!collapsed && (
        <span className="text-[15px] font-medium leading-none">{item.label}</span>
      )}
    </Link>
  )
}
