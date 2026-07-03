'use client'

import React from 'react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export function Input({ label, error, className = '', ...props }: InputProps) {
  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-xs font-medium text-gray-400">{label}</label>
      )}
      <input
        {...props}
        className={`w-full bg-gray-800 text-gray-200 text-sm rounded-lg px-3 py-2 border outline-none transition-colors ${
          error ? 'border-red-500 focus:border-red-400' : 'border-gray-700 focus:border-purple-500'
        } ${className}`}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}
