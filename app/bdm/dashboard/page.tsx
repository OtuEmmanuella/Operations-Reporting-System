'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Package, DollarSign, FileText, Clock, CheckCircle, Users } from 'lucide-react'
import { format } from 'date-fns'
import Link from 'next/link'

interface Report {
  id: string
  type: 'stock' | 'sales' | 'expense'
  manager_name: string
  date: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  amount?: number
}

interface Stats {
  stock: number
  sales: number
  expense: number
  total_pending: number
}

export default function BDMDashboard() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<Stats>({ stock: 0, sales: 0, expense: 0, total_pending: 0 })
  const [recentReports, setRecentReports] = useState<Report[]>([])

  useEffect(() => {
    loadDashboardData()

    // Set up real-time subscriptions
    const stockChannel = supabase
      .channel('stock_reports_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_reports' }, () => {
        loadDashboardData()
      })
      .subscribe()

    const salesChannel = supabase
      .channel('sales_reports_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales_reports' }, () => {
        loadDashboardData()
      })
      .subscribe()

    const expenseChannel = supabase
      .channel('expense_reports_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expense_reports' }, () => {
        loadDashboardData()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(stockChannel)
      supabase.removeChannel(salesChannel)
      supabase.removeChannel(expenseChannel)
    }
  }, [])

  const loadDashboardData = async () => {
    try {
      // Get today's date
      const today = new Date().toISOString().split('T')[0]

      // Fetch reports with user information
      const [stockData, salesData, expenseData] = await Promise.all([
        supabase
          .from('stock_reports')
          .select('*, users!stock_reports_manager_id_fkey(full_name)')
          .eq('report_date', today)
          .order('created_at', { ascending: false }),
        supabase
          .from('sales_reports')
          .select('*, users!sales_reports_manager_id_fkey(full_name)')
          .eq('report_date', today)
          .order('created_at', { ascending: false }),
        supabase
          .from('expense_reports')
          .select('*, users!expense_reports_manager_id_fkey(full_name)')
          .eq('report_date', today)
          .order('created_at', { ascending: false }),
      ])

      // Transform data with proper type handling
      const allReports: Report[] = [
        ...(stockData.data || []).map((r: any) => ({
          id: r.id,
          type: 'stock' as const,
          manager_name: r.users?.full_name || 'Unknown',
          date: r.report_date,
          status: r.status,
          created_at: r.created_at,
        })),
        ...(salesData.data || []).map((r: any) => ({
          id: r.id,
          type: 'sales' as const,
          manager_name: r.users?.full_name || 'Unknown',
          date: r.report_date,
          status: r.status,
          created_at: r.created_at,
          amount: r.total_amount,
        })),
        ...(expenseData.data || []).map((r: any) => ({
          id: r.id,
          type: 'expense' as const,
          manager_name: r.users?.full_name || 'Unknown',
          date: r.report_date,
          status: r.status,
          created_at: r.created_at,
          amount: r.total_amount,
        })),
      ]

      // Sort by created_at
      allReports.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

      // Calculate stats
      const newStats = {
        stock: stockData.data?.length || 0,
        sales: salesData.data?.length || 0,
        expense: expenseData.data?.length || 0,
        total_pending: allReports.filter(r => r.status === 'pending').length,
      }

      setStats(newStats)
      setRecentReports(allReports)
    } catch (error) {
      console.error('Error loading dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  const getReportIcon = (type: string) => {
    switch (type) {
      case 'stock':
        return <Package className="w-5 h-5" />
      case 'sales':
        return <DollarSign className="w-5 h-5" />
      case 'expense':
        return <FileText className="w-5 h-5" />
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

  const getReportColor = (type: string) => {
    switch (type) {
      case 'stock':
        return 'bg-blue-500'
      case 'sales':
        return 'bg-green-500'
      case 'expense':
        return 'bg-purple-500'
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
        <h1 className="text-3xl font-bold text-gray-900">BDM Dashboard</h1>
        <p className="text-gray-600 mt-2">Monitor all manager reports in real-time</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-gray-600">Stock Reports</div>
              <div className="text-3xl font-bold text-gray-900 mt-2">{stats.stock}</div>
            </div>
            <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
              <Package className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-gray-600">Sales Reports</div>
              <div className="text-3xl font-bold text-gray-900 mt-2">{stats.sales}</div>
            </div>
            <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-gray-600">Expense Reports</div>
              <div className="text-3xl font-bold text-gray-900 mt-2">{stats.expense}</div>
            </div>
            <div className="w-12 h-12 bg-purple-500 rounded-lg flex items-center justify-center">
              <FileText className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-gray-600">Pending Review</div>
              <div className="text-3xl font-bold text-warning mt-2">{stats.total_pending}</div>
            </div>
            <div className="w-12 h-12 bg-warning rounded-lg flex items-center justify-center">
              <Clock className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Live Reports Feed */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">Today's Reports Feed</h2>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-danger rounded-full animate-pulse"></div>
            <span className="text-sm font-medium text-gray-600">LIVE</span>
          </div>
        </div>

        <div className="card">
          {recentReports.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No reports submitted today</p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentReports.map((report) => (
                <div
                  key={report.id}
                  className="flex items-center justify-between pb-4 border-b border-gray-200 last:border-0 last:pb-0"
                >
                  <div className="flex items-center space-x-4 flex-1">
                    <div className={`w-10 h-10 ${getReportColor(report.type)} rounded-lg flex items-center justify-center`}>
                      {getReportIcon(report.type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-gray-900">{report.manager_name}</span>
                        <span className="text-gray-400">•</span>
                        <span className="text-gray-600">{getReportTypeLabel(report.type)}</span>
                        {report.status === 'pending' && (
                          <>
                            <span className="text-gray-400">•</span>
                            <span className="text-xs font-medium text-warning">NEW</span>
                          </>
                        )}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        {format(new Date(report.created_at), 'h:mm a')} • {format(new Date(report.date), 'MMM dd, yyyy')}
                        {report.amount && ` • ₦${report.amount.toFixed(2)}`}
                      </div>
                    </div>
                  </div>
                  <div>
                    <span className={`status-badge status-${report.status}`}>
                      {report.status.charAt(0).toUpperCase() + report.status.slice(1)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Link to Pending */}
      {stats.total_pending > 0 && (
        <div className="mt-6">
          <Link href="/bdm/pending" className="btn-primary inline-flex items-center">
            <Clock className="w-5 h-5 mr-2" />
            Review {stats.total_pending} Pending Report{stats.total_pending > 1 ? 's' : ''}
          </Link>
        </div>
      )}
    </div>
  )
}