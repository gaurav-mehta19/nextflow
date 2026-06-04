'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UserButton, useUser } from '@clerk/nextjs'
import {
  Plus,
  Search,
  MessageSquare,
  Folder,
  Library,
  Workflow,
  Boxes,
  BookOpen,
  Settings,
  Gift,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  type LucideIcon,
} from 'lucide-react'
import { useSidebarStore } from '../../lib/store/sidebar.store'

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

  // Rehydrate the persisted collapse state after mount so SSR + first client
  // paint match (avoids a flash). `skipHydration: true` on the store makes
  // this explicit handoff necessary.
  useEffect(() => {
    void useSidebarStore.persist.rehydrate()
  }, [])

  const isActive = (href: string) => {
    const path = href.split('?')[0]
    return pathname === path
  }

  return (
    <aside
      aria-label="Primary navigation"
      data-collapsed={collapsed}
      className={`group/sidebar sticky top-0 h-screen shrink-0 z-30 flex flex-col border-r border-gray-200 bg-[#fafafa] transition-[width] duration-200 ease-out ${
        collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH
      }`}
    >
      <Header collapsed={collapsed} onToggle={toggle} />

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

      <EmptyState collapsed={collapsed} />

      <Footer collapsed={collapsed} userName={user?.fullName ?? user?.firstName ?? null} />
    </aside>
  )
}

interface HeaderProps {
  collapsed: boolean
  onToggle: () => void
}

function Header({ collapsed, onToggle }: HeaderProps) {
  return (
    <div
      className={`flex items-center h-[60px] px-3 ${
        collapsed ? 'justify-center' : 'pl-4 pr-3'
      }`}
    >
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

function LogoMark() {
  return (
    <Link
      href="/dashboard"
      aria-label="NextFlow home"
      className="flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 text-white shadow-sm"
    >
      <Workflow size={18} strokeWidth={2.25} />
    </Link>
  )
}

function Logo() {
  return (
    <Link href="/dashboard" className="flex items-center gap-1.5 group/logo">
      <span className="flex items-center justify-center w-7 h-7 rounded-md bg-gradient-to-br from-indigo-500 to-purple-500 text-white shadow-sm">
        <Workflow size={16} strokeWidth={2.25} />
      </span>
      <span className="text-[19px] font-semibold tracking-tight text-gray-900">
        NextFlow
      </span>
    </Link>
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

function EmptyState({ collapsed }: { collapsed: boolean }) {
  if (collapsed) return <div className="flex-1" aria-hidden />
  return (
    <div className="flex-1 flex items-center justify-center px-4">
      <p className="text-sm text-gray-500">No tasks yet</p>
    </div>
  )
}

interface FooterProps {
  collapsed: boolean
  userName: string | null
}

function Footer({ collapsed, userName }: FooterProps) {
  return (
    <div
      className={`flex flex-col gap-2 border-t border-gray-200/70 ${
        collapsed ? 'p-2' : 'p-3'
      }`}
    >
      {collapsed ? (
        <>
          <button
            type="button"
            aria-label="Settings"
            title="Settings"
            className="flex items-center justify-center w-full h-10 rounded-lg text-gray-600 hover:bg-gray-200/60 hover:text-gray-900 transition-colors"
          >
            <Settings size={18} strokeWidth={1.75} />
          </button>
          <div className="flex items-center justify-center pt-1">
            <UserButton
              afterSignOutUrl="/sign-in"
              appearance={{ elements: { avatarBox: 'w-8 h-8' } }}
            />
          </div>
        </>
      ) : (
        <>
          <button
            type="button"
            className="flex items-center justify-center gap-2 w-full h-10 rounded-full bg-white border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Settings size={16} strokeWidth={1.75} />
            Settings
          </button>
          <button
            type="button"
            className="flex items-center justify-center gap-2 w-full h-10 rounded-full bg-indigo-500 text-sm font-semibold text-white hover:bg-indigo-600 transition-colors shadow-sm"
          >
            <Gift size={16} strokeWidth={2} />
            Claim Offer
          </button>
          <div className="flex justify-center pt-1.5">
            <ChevronDown size={14} className="text-gray-400" aria-hidden />
          </div>
          <div className="flex items-center gap-3 pt-1.5">
            <div className="shrink-0 leading-none">
              <UserButton
                afterSignOutUrl="/sign-in"
                appearance={{
                  elements: {
                    avatarBox: 'w-7 h-7',
                    rootBox: 'shrink-0',
                    userButtonTrigger: 'shrink-0',
                  },
                }}
              />
            </div>
            <span className="text-sm font-semibold text-gray-900 truncate">
              {userName ?? 'Account'}
            </span>
          </div>
        </>
      )}
    </div>
  )
}
