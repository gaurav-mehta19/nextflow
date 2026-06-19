'use client'

import { Handle, type HandleProps } from '@xyflow/react'
import { HandleType, HANDLE_COLORS } from '../../../lib/types/handles'

interface TypedHandleProps extends Omit<HandleProps, 'id'> {
  id: string
  handleType: HandleType

  label?: string

  connected?: boolean
}

export function TypedHandle({ handleType, label, style, ...props }: TypedHandleProps) {
  const color = HANDLE_COLORS[handleType]

  return (
    <Handle
      {...props}
      title={label}
      style={{
        background: color,
        border: `2px solid ${color}`,
        width: 12,
        height: 12,
        borderRadius: '50%',
        cursor: 'crosshair',
        ...style,
      }}
    />
  )
}
