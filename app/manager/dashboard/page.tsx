'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Package, DollarSign, FileText, Clock, CheckCircle, XCircle } from 'lucide-react'
import { format } from 'date-fns'

interface ReportStats {
  total: number
  pending: number
  approved: number
  rejected: number
}

interface RecentReport {
  id: string
  type: 'stock' | 'sales' | 'expense'
  date: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
}

export default function ManagerDashboard() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<ReportStats>({ total: 0, pending: 0, approved: 0, rejected: 0 })
  const [recentReports, setRecentReports] = useState<RecentReport[]>([])

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Fetch all reports
      const [stockData, salesData, expenseData] = await Promise.all([
        supabase.from('stock_reports').select('*').eq('manager_id', user.id).order('created_at', { ascending: false }),
        supabase.from('sales_reports').select('*').eq('manager_id', user.id).order('created_at', { ascending: false }),
        supabase.from('expense_reports').select('*').eq('manager_id', user.id).order('created_at', { ascending: false }),
      ])

      const allReports = [
        ...(stockData.data || []).map(r => ({ ...r, type: 'stock' as const })),
        ...(salesData.data || []).map(r => ({ ...r, type: 'sales' as const })),
        ...(expenseData.data || []).map(r => ({ ...r, type: 'expense' as const })),
      ]

      // Calculate stats
      const statsCalc = {
        total: allReports.length,
        pending: allReports.filter(r => r.status === 'pending').length,
        approved: allReports.filter(r => r.status === 'approved').length,
        rejected: allReports.filter(r => r.status === 'rejected').length,
      }

      // Get recent reports (last 5)
      const recent = allReports
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5)
        .map(r => ({
          id: r.id,
          type: r.type,
          date: r.report_date,
          status: r.status,
          created_at: r.created_at,
        }))

      setStats(statsCalc)
      setRecentReports(recent)
    } catch (error) {
      console.error('Error loading dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  const quickActions = [
    {
      title: 'Submit Stock Report',
      description: 'Report current inventory levels',
      icon: Package,
      href: '/manager/stock-report',
      color: 'bg-blue-500',
    },
    {
      title: 'Submit Sales Report',
      description: 'Record today\'s sales',
      icon: DollarSign,
      href: '/manager/sales-report',
      color: 'bg-green-500',
    },
    {
      title: 'Submit Expense Report',
      description: 'Log requisitions received',
      icon: FileText,
      href: '/manager/expense-report',
      color: 'bg-purple-500',
    },
  ]

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4" />
      case 'approved':
        return <CheckCircle className="w-4 h-4" />
      case 'rejected':
        return <XCircle className="w-4 h-4" />
    }
  }

  const getReportTypeLabel = (type: string) => {
    switch (type) {
      case 'stock':
        return 'Stock Report'
      case 'sales':
        return 'Sales Report'
      case 'expense':
        return 'Expense Report'
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-lg text-gray-600">Loading dashboard...</div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Welcome Back!</h1>
        <p className="text-gray-600 mt-2">Here's your reporting overview</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="card">
          <div className="text-sm font-medium text-gray-600">Total Reports</div>
          <div className="text-3xl font-bold text-gray-900 mt-2">{stats.total}</div>
        </div>
        <div className="card">
          <div className="text-sm font-medium text-gray-600">Pending</div>
          <div className="text-3xl font-bold text-warning mt-2">{stats.pending}</div>
        </div>
        <div className="card">
          <div className="text-sm font-medium text-gray-600">Approved</div>
          <div className="text-3xl font-bold text-success mt-2">{stats.approved}</div>
        </div>
        <div className="card">
          <div className="text-sm font-medium text-gray-600">Rejected</div>
          <div className="text-3xl font-bold text-danger mt-2">{stats.rejected}</div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {quickActions.map((action) => {
            const Icon = action.icon
            return (
              <Link key={action.href} href={action.href}>
                <div className="card hover:shadow-md transition-shadow duration-200 cursor-pointer">
                  <div className={`w-12 h-12 ${action.color} rounded-lg flex items-center justify-center mb-4`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">{action.title}</h3>
                  <p className="text-gray-600 text-sm mt-1">{action.description}</p>
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Recent Submissions */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Submissions</h2>
        <div className="card">
          {recentReports.length === 0 ? (
            <p className="text-gray-600 text-center py-8">No reports submitted yet</p>
          ) : (
            <div className="space-y-4">
              {recentReports.map((report) => (
                <div key={report.id} className="flex items-center justify-between pb-4 border-b border-gray-200 last:border-0 last:pb-0">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{getReportTypeLabel(report.type)}</div>
                    <div className="text-sm text-gray-600 mt-1">
                      {format(new Date(report.date), 'MMM dd, yyyy')} • Submitted {format(new Date(report.created_at), 'MMM dd, yyyy')}
                    </div>
                  </div>
                  <div>
                    <span className={`status-badge status-${report.status}`}>
                      <span className="mr-1">{getStatusIcon(report.status)}</span>
                      {report.status.charAt(0).toUpperCase() + report.status.slice(1)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
