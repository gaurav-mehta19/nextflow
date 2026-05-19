interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'success' | 'error' | 'warning' | 'info'
}

const variantClasses: Record<string, string> = {
  default: 'bg-gray-100 text-gray-500 border border-gray-200',
  success: 'bg-green-50 text-green-600 border border-green-200',
  error: 'bg-red-50 text-red-600 border border-red-200',
  warning: 'bg-yellow-50 text-yellow-600 border border-yellow-200',
  info: 'bg-blue-50 text-blue-600 border border-blue-200',
}

export function Badge({ children, variant = 'default' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variantClasses[variant]}`}>
      {children}
    </span>
  )
}
