'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Home, Package, DollarSign, FileText, BarChart3, LogOut, Users, Bell, CheckCircle, XCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import clsx from 'clsx'

interface UserProfile {
  full_name: string
  role: 'manager' | 'bdm'
  position?: string | null
  department?: string | null
}

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadUserProfile()
  }, [])

  const loadUserProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/')
        return
      }

      // Fetch user profile from users table
      const { data: profile, error } = await supabase
        .from('users')
        .select('full_name, role, position, department')
        .eq('id', user.id)
        .single()

      if (error) {
        console.error('Error loading user profile:', error)
        // If profile doesn't exist, create it
        if (error.code === 'PGRST116') {
          const role: 'manager' | 'bdm' = user.email?.includes('bdm') ? 'bdm' : 'manager'
          const fullName = user.email?.split('@')[0] || 'User'
          
          const { error: insertError } = await supabase
            .from('users')
            .insert({
              id: user.id,
              email: user.email!,
              full_name: fullName,
              role: role
            })

          if (!insertError) {
            setUserProfile({
              full_name: fullName,
              role: role,
              position: null,
              department: null
            })
          } else {
            console.error('Error creating profile:', insertError)
          }
        }
      } else {
        setUserProfile(profile)
      }
    } catch (error) {
      console.error('Error in loadUserProfile:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const managerLinks = [
    { href: '/manager/dashboard', label: 'Home', icon: Home },
    { href: '/manager/stock-report', label: 'Stock Report', icon: Package },
    { href: '/manager/sales-report', label: 'Sales Report', icon: DollarSign },
    { href: '/manager/expense-report', label: 'Expense Report', icon: FileText },
    { href: '/manager/my-reports', label: 'My Reports', icon: BarChart3 },
  ]

  const bdmLinks = [
    { href: '/bdm/dashboard', label: 'Home', icon: Home },
    { href: '/bdm/pending', label: 'Pending Reports', icon: Bell },
    { href: '/bdm/approved', label: 'Approved Reports', icon: CheckCircle },
    { href: '/bdm/rejected', label: 'Rejected Reports', icon: XCircle },
    { href: '/bdm/analytics', label: 'Analytics', icon: BarChart3 },
    { href: '/bdm/managers', label: 'Managers', icon: Users },
  ]

  if (loading || !userProfile) {
    return (
      <div className="w-64 bg-white border-r border-gray-200 h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    )
  }

  const links = userProfile.role === 'manager' ? managerLinks : bdmLinks

  // Get initials from name
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <div className="w-64 bg-white border-r border-gray-200 h-screen flex flex-col">
      {/* User Profile Section */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center space-x-3 mb-3">
          {/* Avatar with Initials */}
          <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
            {getInitials(userProfile.full_name)}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-gray-900 truncate">{userProfile.full_name}</h2>
            <p className="text-xs text-gray-500 truncate">
              {userProfile.position || (userProfile.role === 'manager' ? 'Manager' : 'Business Development Manager')}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="inline-block px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary rounded">
            {userProfile.role === 'manager' ? 'Manager' : 'BDM'}
          </span>
          {userProfile.department && (
            <span className="text-xs text-gray-500 truncate max-w-[100px]">
              {userProfile.department}
            </span>
          )}
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {links.map((link) => {
          const Icon = link.icon
          const isActive = pathname === link.href

          return (
            <Link
              key={link.href}
              href={link.href}
              className={clsx(
                'flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors duration-200',
                isActive
                  ? 'bg-primary text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{link.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Logout Button */}
      <div className="p-4 border-t border-gray-200">
        <button
          onClick={handleLogout}
          className="flex items-center space-x-3 px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-100 w-full transition-colors duration-200"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Logout</span>
        </button>
      </div>
    </div>
  )
}