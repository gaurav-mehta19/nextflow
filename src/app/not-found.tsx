'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Workflow, ArrowRight, Compass } from 'lucide-react'

const REDIRECT_SECONDS = 10

export default function NotFound() {
  const router = useRouter()
  const [secondsLeft, setSecondsLeft] = useState(REDIRECT_SECONDS)

  useEffect(() => {
    const deadline = Date.now() + REDIRECT_SECONDS * 1000
    const tick = setInterval(() => {

      const remainingMs = Math.max(0, deadline - Date.now())
      setSecondsLeft(Math.ceil(remainingMs / 1000))
    }, 250)
    const redirect = setTimeout(() => {
      router.replace('/dashboard')
    }, REDIRECT_SECONDS * 1000)
    return () => {
      clearInterval(tick)
      clearTimeout(redirect)
    }
  }, [router])

  const progress = ((REDIRECT_SECONDS - secondsLeft) / REDIRECT_SECONDS) * 100

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fafafa] px-6">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 shadow-sm">
          <Compass size={26} strokeWidth={2} className="text-white" />
        </div>

        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
          This page is still being built
        </h1>
        <p className="mt-2 text-sm text-gray-500 leading-relaxed">
          That section of NextFlow isn&rsquo;t available yet. We&rsquo;ll take you back to your
          workflows in a moment.
        </p>

        <div className="mt-8 flex flex-col items-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-full bg-gray-900 text-white text-sm font-medium px-5 h-10 hover:bg-gray-700 transition-colors"
          >
            <Workflow size={15} />
            Go to dashboard
            <ArrowRight size={15} />
          </Link>

          <p className="text-xs text-gray-400" aria-live="polite">
            Redirecting in {secondsLeft}s
          </p>

          <div
            className="w-48 h-1 bg-gray-200/80 rounded-full overflow-hidden"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress)}
          >
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-[width] duration-1000 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
