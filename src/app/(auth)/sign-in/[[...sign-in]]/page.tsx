import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">NextFlow</h1>
          <p className="text-gray-500 text-sm mt-1">LLM Workflow Builder</p>
        </div>
        <SignIn />
      </div>
    </div>
  )
}
