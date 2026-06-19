import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface SidebarState {
  collapsed: boolean
  toggle: () => void
  setCollapsed: (collapsed: boolean) => void
}

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({
      collapsed: false,
      toggle: () => set((s) => ({ collapsed: !s.collapsed })),
      setCollapsed: (collapsed) => set({ collapsed }),
    }),
    {
      name: 'nextflow:sidebar',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ collapsed: state.collapsed }),

      skipHydration: true,
    },
  ),
)
