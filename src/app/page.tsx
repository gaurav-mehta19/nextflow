import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs'

export default function HomePage() {
  const { userId } = auth()
  if (userId) {
    redirect('/dashboard')
  } else {
    redirect('/sign-in')
  }
}
