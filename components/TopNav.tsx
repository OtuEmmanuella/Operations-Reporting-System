'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { LogOut, User, ChevronDown } from 'lucide-react'

export default function TopNav() {
  const router = useRouter()
  const [userName, setUserName] = useState('')
  const [userRole, setUserRole] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadUser()
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('#user-menu')) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const loadUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('users')
      .select('full_name, role')
      .eq('id', user.id)
      .single()
    if (data) {
      setUserName(data.full_name)
      setUserRole(data.role)
    }
  }

  const handleLogout = async () => {
    setLoading(true)
    await supabase.auth.signOut()
    router.push('/')
  }

  const getInitials = (name: string) =>
    name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

  const getRoleLabel = (role: string) => ({
    front_office_manager: 'Front Office Manager',
    manager: 'Store Manager',
    bdm: 'Business Dev. Manager',
  }[role] || 'User')

  return (
    <header className="bg-white border-b border-gray-200 h-14 flex items-center justify-between px-6 flex-shrink-0 sticky top-0 z-40">
      {/* Left: App name / breadcrumb area */}
      <div className="flex items-center space-x-2">
        <div className="w-6 h-6 bg-primary rounded flex items-center justify-center">
          <span className="text-white text-xs font-bold">R</span>
        </div>
        <span className="font-semibold text-gray-800 text-sm">ReportHub</span>
      </div>

      {/* Right: User menu */}
      <div className="relative" id="user-menu">
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center space-x-2.5 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
        >
          {/* Avatar */}
          <div className="w-7 h-7 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">
              {userName ? getInitials(userName) : <User className="w-3.5 h-3.5" />}
            </span>
          </div>

          {/* Name + role */}
          {userName && (
            <div className="text-left hidden sm:block">
              <div className="text-sm font-medium text-gray-800 leading-tight">{userName}</div>
              <div className="text-xs text-gray-400 leading-tight">{getRoleLabel(userRole)}</div>
            </div>
          )}

          <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Dropdown */}
        {dropdownOpen && (
          <div className="absolute right-0 mt-1.5 w-48 bg-white rounded-xl shadow-lg border border-gray-200 py-1.5 z-50">
            {/* User info in dropdown */}
            <div className="px-4 py-2.5 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-900 truncate">{userName}</p>
              <p className="text-xs text-gray-400 truncate">{getRoleLabel(userRole)}</p>
            </div>

            {/* Logout */}
            <button
              onClick={handleLogout}
              disabled={loading}
              className="w-full flex items-center space-x-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              <LogOut className="w-4 h-4 flex-shrink-0" />
              <span>{loading ? 'Logging out...' : 'Log out'}</span>
            </button>
          </div>
        )}
      </div>
    </header>
  )
}