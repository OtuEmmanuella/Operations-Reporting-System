'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'

interface UserData {
  full_name: string
  role: string
}

export default function ManagerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [userName, setUserName] = useState('')

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        router.push('/')
        return
      }

      // Get user data - using maybeSingle() instead of single()
      const { data: userData, error } = await supabase
        .from('users')
        .select('full_name, role')
        .eq('id', session.user.id)
        .maybeSingle()

      if (error) {
        console.error('Error fetching user:', error)
        router.push('/')
        return
      }

      if (!userData) {
        console.log('No user data found')
        router.push('/')
        return
      }

      const typedUserData = userData as UserData

      if (typedUserData.role !== 'manager') {
        router.push('/bdm/dashboard')
        return
      }

      setUserName(typedUserData.full_name)
      setLoading(false)
    }

    checkAuth()
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar userRole="manager" userName={userName} />
      <main className="flex-1 overflow-y-auto bg-gray-50">
        {children}
      </main>
    </div>
  )
}