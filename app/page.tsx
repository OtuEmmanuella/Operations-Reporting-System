'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { LogIn } from 'lucide-react'

interface UserData {
  role: string
  full_name: string
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) throw signInError

      // Check if user exists in users table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('role, full_name')
        .eq('id', data.user.id)
        .maybeSingle()

      if (userError && userError.code !== 'PGRST116') {
        throw userError
      }

      // If user doesn't exist in users table, create them
      if (!userData) {
        console.log('User not found in users table, creating...')
        
        // Determine role based on email (you can change this logic)
        const role: 'manager' | 'bdm' = email.includes('bdm') ? 'bdm' : 'manager'
        const fullName = data.user.email?.split('@')[0] || 'User'
        
        const { error: insertError } = await supabase
          .from('users')
          .insert([{
            id: data.user.id,
            email: data.user.email!,
            full_name: fullName,
            role: role
          }])

        if (insertError) {
          console.error('Error creating user:', insertError)
          
          // If it's a duplicate key error, try to fetch the user again
          if (insertError.code === '23505') {
            const { data: retryUserData } = await supabase
              .from('users')
              .select('role, full_name')
              .eq('id', data.user.id)
              .maybeSingle()

            if (retryUserData) {
              const typedRetryData = retryUserData as UserData
              if (typedRetryData.role === 'bdm') {
                router.push('/bdm/dashboard')
              } else {
                router.push('/manager/dashboard')
              }
              return
            }
          }
          
          throw new Error('Failed to create user profile. Please contact administrator.')
        }

        // Redirect based on role
        if (role === 'bdm') {
          router.push('/bdm/dashboard')
        } else {
          router.push('/manager/dashboard')
        }
      } else {
        const typedUserData = userData as UserData

        // Redirect based on role
        if (typedUserData.role === 'bdm') {
          router.push('/bdm/dashboard')
        } else {
          router.push('/manager/dashboard')
        }
      }
    } catch (err: any) {
      console.error('Login error:', err)
      setError(err.message || 'Invalid credentials')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4">
            <LogIn className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Report Flow</h1>
          <p className="text-gray-600 mt-2">Sign in to your account</p>
        </div>

        <div className="bg-white rounded-xl shadow-xl p-8">
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                placeholder="manager@company.com"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 focus:ring-4 focus:ring-blue-300 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800 font-medium mb-2">Note:</p>
            <p className="text-xs text-blue-700">If you have an existing account, it will automatically detect your role and redirect you to the appropriate dashboard.</p>
          </div>

          <p className="text-center text-sm text-gray-600 mt-6">
            Contact your administrator to get login credentials
          </p>
        </div>
      </div>
    </div>
  )
}