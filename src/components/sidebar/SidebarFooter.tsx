'use client'

import { UserButton, useClerk } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { Settings, Gift, ChevronDown, LogOut } from 'lucide-react'

interface Props {
  collapsed: boolean
  userName: string | null
}

export function SidebarFooter({ collapsed, userName }: Props) {
  const { signOut } = useClerk()
  const router = useRouter()

  const handleSignOut = async () => {
    await signOut()
    router.push('/sign-in')
  }

  return (
    <div className={`flex flex-col gap-2 border-t border-gray-200/70 ${collapsed ? 'p-2' : 'p-3'}`}>
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
            <UserButton afterSignOutUrl="/sign-in" appearance={{ elements: { avatarBox: 'w-8 h-8' } }} />
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
            <span className="flex-1 min-w-0 text-sm font-semibold text-gray-900 truncate">
              {userName ?? 'Account'}
            </span>
            <button
              type="button"
              onClick={() => { void handleSignOut() }}
              aria-label="Sign out"
              title="Sign out"
              className="shrink-0 flex items-center justify-center w-8 h-8 rounded-md text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut size={16} strokeWidth={1.75} />
            </button>
          </div>
        </>
      )}
    </div>
  )
}
