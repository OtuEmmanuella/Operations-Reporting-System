'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Home, Package, DollarSign, FileText, BarChart3, LogOut, Users, Bell,
  CheckCircle, XCircle, ChevronDown, ChevronRight, Clock, Hotel, AlertTriangle,
  TrendingUp, MessageSquare, Menu, X, ChevronLeft, Settings, UserCheck
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import clsx from 'clsx'

interface UserProfile {
  full_name: string
  role: 'manager' | 'bdm' | 'front_office_manager'
  position?: string | null
  department?: string | null
}

interface NavSection {
  label: string
  icon: React.ElementType
  items: { href: string; label: string; icon: React.ElementType }[]
}

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [collapsed, setCollapsed] = useState(false)
  const [openSections, setOpenSections] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadUserProfile()
  }, [])

  // Auto-open section if current path matches
  useEffect(() => {
    if (!userProfile) return
    const sections = getSections(userProfile.role)
    sections.forEach(sec => {
      if (sec.items.some(item => pathname.startsWith(item.href))) {
        setOpenSections(prev => new Set([...prev, sec.label]))
      }
    })
  }, [pathname, userProfile])

  const loadUserProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      const { data: profile, error } = await supabase.from('users').select('full_name, role, position, department').eq('id', user.id).single()

      if (error && error.code === 'PGRST116') {
        const role: 'manager' | 'bdm' | 'front_office_manager' =
          user.email?.includes('bdm') ? 'bdm' :
          user.email?.includes('frontoffice') || user.email?.includes('front') ? 'front_office_manager' : 'manager'
        const fullName = user.email?.split('@')[0] || 'User'
        await supabase.from('users').insert({ id: user.id, email: user.email!, full_name: fullName, role })
        setUserProfile({ full_name: fullName, role, position: null, department: null })
      } else if (profile) {
        setUserProfile(profile)
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const toggleSection = (label: string) => {
    setOpenSections(prev => {
      const next = new Set(prev)
      next.has(label) ? next.delete(label) : next.add(label)
      return next
    })
  }

  const getSections = (role: string): NavSection[] => {
    if (role === 'manager') return [
      {
        label: 'Overview', icon: Home,
        items: [{ href: '/manager/dashboard', label: 'Dashboard', icon: Home }],
      },
      {
        label: 'Submit Reports', icon: FileText,
        items: [
          { href: '/manager/stock-report', label: 'Stock Report', icon: Package },
          { href: '/manager/sales-report', label: 'Sales Report', icon: DollarSign },
          { href: '/manager/expense-report', label: 'Expense Report', icon: FileText },
        ],
      },
      {
        label: 'My Reports', icon: Bell,
        items: [
          { href: '/manager/reports/pending', label: 'Pending', icon: Clock },
          { href: '/manager/reports/approved', label: 'Approved', icon: CheckCircle },
          { href: '/manager/reports/rejected', label: 'Rejected', icon: XCircle },
        ],
      },
    ]

    if (role === 'bdm') return [
      {
        label: 'Overview', icon: Home,
        items: [
          { href: '/bdm/dashboard', label: 'Dashboard', icon: Home },
          { href: '/bdm/managers', label: 'Managers', icon: Users },
        ],
      },
      {
        label: 'All Reports', icon: Bell,
        items: [
          { href: '/bdm/pending', label: 'Pending', icon: Clock },
          { href: '/bdm/approved', label: 'Approved', icon: CheckCircle },
          { href: '/bdm/rejected', label: 'Rejected', icon: XCircle },
        ],
      },
    ]

    // front_office_manager
    return [
      {
        label: 'Overview', icon: Home,
        items: [{ href: '/front-office/dashboard', label: 'Dashboard', icon: Home }],
      },
      {
        label: 'Daily Reports', icon: FileText,
        items: [
          { href: '/front-office/occupancy-report', label: 'Room Occupancy', icon: Hotel },
          { href: '/front-office/guest-activity-report', label: 'Guest Activity', icon: Users },
          { href: '/front-office/revenue-report', label: 'Revenue Report', icon: TrendingUp },
          { href: '/front-office/complaint-report', label: 'Log Complaint', icon: AlertTriangle },
        ],
      },
      {
        label: 'My Reports', icon: Bell,
        items: [
          { href: '/front-office/reports/pending', label: 'Pending', icon: Clock },
          { href: '/front-office/reports/approved', label: 'Approved', icon: CheckCircle },
          { href: '/front-office/reports/rejected', label: 'Rejected', icon: XCircle },
        ],
      },
      {
        label: 'Complaints', icon: MessageSquare,
        items: [
          { href: '/front-office/complaints', label: 'Pending Complaints', icon: AlertTriangle },
          { href: '/front-office/complaints/resolved', label: 'Resolved Complaints', icon: CheckCircle },
        ],
      },
    ]
  }

  const getInitials = (name: string) =>
    name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

  const getRoleLabel = (role: string) => ({
    manager: 'Store Manager', bdm: 'Business Dev. Manager', front_office_manager: 'Front Office Manager'
  }[role] || 'User')

  const getRoleColor = (role: string) => ({
    manager: 'bg-indigo-100 text-indigo-700', bdm: 'bg-purple-100 text-purple-700', front_office_manager: 'bg-teal-100 text-teal-700'
  }[role] || 'bg-gray-100 text-gray-700')

  if (loading || !userProfile) {
    return (
      <div className="w-64 bg-white border-r border-gray-200 h-screen flex items-center justify-center">
        <div className="text-gray-400 text-sm">Loading...</div>
      </div>
    )
  }

  const sections = getSections(userProfile.role)

  return (
    <div className={clsx(
      'bg-white border-r border-gray-200 h-screen flex flex-col transition-all duration-300',
      collapsed ? 'w-16' : 'w-64'
    )}>
      {/* Header */}
      <div className={clsx('flex items-center border-b border-gray-200 h-16 flex-shrink-0', collapsed ? 'justify-center px-3' : 'justify-between px-5')}>
        {!collapsed && (
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-gray-900 text-sm">ReportHub</span>
          </div>
        )}
        <button onClick={() => setCollapsed(!collapsed)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* User profile */}
      {!collapsed && (
        <div className="px-4 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              {getInitials(userProfile.full_name)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{userProfile.full_name}</p>
              {userProfile.department && <p className="text-xs text-gray-400 truncate">{userProfile.department}</p>}
            </div>
          </div>
          <span className={clsx('mt-2 inline-block px-2 py-0.5 text-xs font-medium rounded-full', getRoleColor(userProfile.role))}>
            {getRoleLabel(userProfile.role)}
          </span>
        </div>
      )}
      {collapsed && (
        <div className="py-3 flex justify-center border-b border-gray-100 flex-shrink-0">
          <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white font-bold text-xs">
            {getInitials(userProfile.full_name)}
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
        {sections.map(section => {
          const isOpen = openSections.has(section.label)
          const SectionIcon = section.icon
          const hasActiveItem = section.items.some(item => pathname === item.href || pathname.startsWith(item.href + '/'))

          if (collapsed) {
            // Collapsed: show only icons with tooltip
            return (
              <div key={section.label} className="space-y-0.5">
                {section.items.map(item => {
                  const Icon = item.icon
                  const isActive = pathname === item.href
                  return (
                    <Link key={item.href} href={item.href} title={item.label}
                      className={clsx('flex items-center justify-center w-10 h-10 mx-auto rounded-lg transition-colors',
                        isActive ? 'bg-primary text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700')}>
                      <Icon className="w-5 h-5" />
                    </Link>
                  )
                })}
              </div>
            )
          }

          return (
            <div key={section.label} className="mb-1">
              {/* Section header - clickable to expand/collapse */}
              <button onClick={() => toggleSection(section.label)}
                className={clsx(
                  'w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors',
                  hasActiveItem ? 'text-primary bg-primary/5' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                )}>
                <div className="flex items-center space-x-2">
                  <SectionIcon className="w-4 h-4" />
                  <span>{section.label}</span>
                </div>
                {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>

              {/* Section items */}
              {isOpen && (
                <div className="mt-0.5 ml-2 space-y-0.5">
                  {section.items.map(item => {
                    const Icon = item.icon
                    const isActive = pathname === item.href
                    return (
                      <Link key={item.href} href={item.href}
                        className={clsx(
                          'flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                          isActive ? 'bg-primary text-white font-medium' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                        )}>
                        <Icon className="w-4 h-4 flex-shrink-0" />
                        <span>{item.label}</span>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* Logout */}
      <div className={clsx('border-t border-gray-100 p-2 flex-shrink-0')}>
        <button onClick={handleLogout}
          className={clsx(
            'flex items-center rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors',
            collapsed ? 'w-10 h-10 mx-auto justify-center' : 'w-full space-x-3 px-3 py-2.5 text-sm'
          )}
          title={collapsed ? 'Logout' : undefined}>
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span className="font-medium">Logout</span>}
        </button>
      </div>
    </div>
  )
}