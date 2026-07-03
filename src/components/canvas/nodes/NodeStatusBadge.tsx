'use client'

import type { NodeRunStatus } from '../../../lib/types/workflow'

interface Props {
  status: NodeRunStatus | undefined
}

export function NodeStatusBadge({ status }: Props) {
  if (status === 'RUNNING') {
    return (
      <span className="ml-auto text-[10px] font-medium tracking-wide uppercase bg-purple-500 text-white px-2 py-0.5 rounded-full animate-pulse">
        Running
      </span>
    )
  }
  if (status === 'SUCCESS') {
    return (
      <span className="ml-auto text-[10px] font-medium tracking-wide uppercase bg-green-500 text-white px-2 py-0.5 rounded-full">
        Done
      </span>
    )
  }
  if (status === 'FAILED') {
    return (
      <span className="ml-auto text-[10px] font-medium tracking-wide uppercase bg-red-500 text-white px-2 py-0.5 rounded-full">
        Failed
      </span>
    )
  }
  return null
}
