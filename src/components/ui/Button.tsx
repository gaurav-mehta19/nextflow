'use client'

import React from 'react'
import { Loader2 } from 'lucide-react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

const variantClasses: Record<string, string> = {
  primary: 'bg-purple-600 hover:bg-purple-500 text-white border-transparent shadow-sm focus-visible:ring-purple-500/40',
  secondary: 'bg-white hover:bg-gray-50 text-gray-700 border-gray-200 hover:border-gray-300 focus-visible:ring-gray-300',
  ghost: 'bg-transparent hover:bg-gray-100 text-gray-500 hover:text-gray-800 border-transparent focus-visible:ring-gray-300',
  danger: 'bg-red-700 hover:bg-red-600 text-white border-transparent shadow-sm focus-visible:ring-red-500/40',
}

const sizeClasses: Record<string, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  disabled,
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled ?? loading}
      className={`inline-flex items-center gap-1.5 font-medium rounded-lg border transition-all whitespace-nowrap active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
    >
      {loading && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  )
}
