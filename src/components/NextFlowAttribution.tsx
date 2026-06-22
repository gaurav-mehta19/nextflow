'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

const CANDIDATE_LINKEDIN =
  process.env.NEXT_PUBLIC_CANDIDATE_LINKEDIN ?? 'https://www.linkedin.com/in/gaurav-mehta-286071247'

export function NextFlowAttribution() {
  const pathname = usePathname()

  useEffect(() => {
    console.log(`[NextFlow] Candidate LinkedIn: ${CANDIDATE_LINKEDIN}`)
  }, [pathname])

  return null
}
