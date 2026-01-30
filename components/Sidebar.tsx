'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Home, Package, DollarSign, FileText, BarChart3, LogOut, Users, Bell, CheckCircle, XCircle, ChevronDown, ChevronRight, Clock } from 'lucide-react'
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
  const [reportsExpanded, setReportsExpanded] = useState(false)

  useEffect(() => {
    loadUserProfile()
    
    // Auto-expand reports if on a reports page (for both manager and bdm)
    if (pathname.includes('/manager/reports/') || pathname.includes('/bdm/pending') || pathname.includes('/bdm/approved') || pathname.includes('/bdm/rejected')) {
      setReportsExpanded(true)
    }
  }, [pathname])

  const loadUserProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/')
        return
      }

      const { data: profile, error } = await supabase
        .from('users')
        .select('full_name, role, position, department')
        .eq('id', user.id)
        .single()

      if (error) {
        console.error('Error loading user profile:', error)
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
  ]

  const managerReportLinks = [
    { href: '/manager/reports/pending', label: 'Pending Reports', icon: Clock },
    { href: '/manager/reports/approved', label: 'Approved Reports', icon: CheckCircle },
    { href: '/manager/reports/rejected', label: 'Rejected Reports', icon: XCircle },
  ]

  const bdmLinks = [
    { href: '/bdm/dashboard', label: 'Home', icon: Home },
    { href: '/bdm/analytics', label: 'Analytics', icon: BarChart3 },
    { href: '/bdm/managers', label: 'Managers', icon: Users },
  ]

  const bdmReportLinks = [
    { href: '/bdm/pending', label: 'Pending Reports', icon: Clock },
    { href: '/bdm/approved', label: 'Approved Reports', icon: CheckCircle },
    { href: '/bdm/rejected', label: 'Rejected Reports', icon: XCircle },
  ]

  if (loading || !userProfile) {
    return (
      <div className="w-64 bg-white border-r border-gray-200 h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    )
  }

  const links = userProfile.role === 'manager' ? managerLinks : bdmLinks

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

        {/* Reports Collapsible Section */}
        <div className="pt-2">
          <button
            onClick={() => setReportsExpanded(!reportsExpanded)}
            className="flex items-center justify-between w-full px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors duration-200"
          >
            <div className="flex items-center space-x-3">
              <Bell className="w-5 h-5" />
              <span className="font-medium">
                {userProfile.role === 'manager' ? 'My Reports' : 'All Reports'}
              </span>
            </div>
            {reportsExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>

          {/* Submenu */}
          {reportsExpanded && (
            <div className="ml-4 mt-1 space-y-1">
              {(userProfile.role === 'manager' ? managerReportLinks : bdmReportLinks).map((link) => {
                const Icon = link.icon
                const isActive = pathname === link.href

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={clsx(
                      'flex items-center space-x-3 px-4 py-2 rounded-lg transition-colors duration-200 text-sm',
                      isActive
                        ? 'bg-primary text-white'
                        : 'text-gray-600 hover:bg-gray-100'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="font-medium">{link.label}</span>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
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