'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Home, Package, DollarSign, FileText, BarChart3, LogOut, Users, Bell } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import clsx from 'clsx'

interface SidebarProps {
  userRole: 'manager' | 'bdm'
  userName: string
}

export default function Sidebar({ userRole, userName }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

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
    { href: '/bdm/pending', label: 'Pending', icon: Bell },
    { href: '/bdm/analytics', label: 'Analytics', icon: BarChart3 },
    { href: '/bdm/managers', label: 'Managers', icon: Users },
  ]

  const links = userRole === 'manager' ? managerLinks : bdmLinks

  return (
    <div className="w-64 bg-white border-r border-gray-200 h-screen flex flex-col">
      {/* Logo/Header */}
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-xl font-bold text-primary">MRS</h2>
        <p className="text-sm text-gray-600 mt-1">{userName}</p>
        <span className="inline-block mt-2 px-2 py-1 text-xs font-medium bg-primary/10 text-primary rounded">
          {userRole === 'manager' ? 'Manager' : 'BDM'}
        </span>
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
