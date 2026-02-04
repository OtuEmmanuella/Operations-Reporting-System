'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ClarificationRedirect() {
  const router = useRouter()
  
  useEffect(() => {
    // Redirect to pending page where clarifications now appear
    router.push('/manager/reports/pending')
  }, [router])
  
  return (
    <div className="p-8">
      <div className="text-lg text-gray-600">Redirecting to pending reports...</div>
    </div>
  )
}
