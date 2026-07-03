import { SignUp } from '@clerk/nextjs'
import { clerkAppearance } from '@/lib/clerk-appearance'

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-purple-50/40 flex items-center justify-center p-4">
      <div className="flex flex-col items-center gap-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold bg-gradient-to-br from-purple-600 to-violet-600 bg-clip-text text-transparent">
            NextFlow
          </h1>
          <p className="text-gray-500 text-sm mt-1">LLM Workflow Builder</p>
        </div>
        <SignUp appearance={clerkAppearance} />
      </div>
    </div>
  )
}
