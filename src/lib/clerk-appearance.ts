import type { Appearance } from '@clerk/types'

/**
 * Shared Clerk appearance so the hosted auth widget matches NextFlow's
 * design language: purple accent, rounded-2xl cards, gray-100 borders,
 * soft shadows and the Inter typeface used across the app.
 */
export const clerkAppearance: Appearance = {
  variables: {
    colorPrimary: '#a855f7', // purple-500 — same accent as selected nodes
    colorText: '#1f2937', // gray-800
    colorTextSecondary: '#6b7280', // gray-500
    colorBackground: '#ffffff',
    colorInputBackground: '#ffffff',
    colorInputText: '#1f2937',
    borderRadius: '0.75rem',
    fontFamily: 'inherit',
    fontSize: '14px',
  },
  elements: {
    rootBox: 'w-full',
    card: 'bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.06)] px-8 py-8',
    headerTitle: 'text-gray-900 font-semibold',
    headerSubtitle: 'text-gray-500',
    socialButtonsBlockButton:
      'border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors',
    socialButtonsBlockButtonText: 'text-gray-700 font-medium',
    dividerLine: 'bg-gray-100',
    dividerText: 'text-gray-400',
    formFieldLabel: 'text-gray-700 font-medium',
    formFieldInput:
      'border border-gray-200 rounded-xl focus:border-purple-400 focus:ring-2 focus:ring-purple-200 transition-colors',
    formButtonPrimary:
      'bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-[0_1px_2px_rgba(15,23,42,0.08)] normal-case font-medium transition-colors',
    footerActionLink: 'text-purple-600 hover:text-purple-700 font-medium',
    identityPreviewEditButton: 'text-purple-600 hover:text-purple-700',
    formResendCodeLink: 'text-purple-600 hover:text-purple-700',
  },
}
