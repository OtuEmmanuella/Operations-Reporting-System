'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Package, DollarSign, FileText, Clock, CheckCircle, Users, AlertTriangle, Hotel, UserCheck, TrendingUp, MessageSquare } from 'lucide-react'
import { format } from 'date-fns'
import Link from 'next/link'

interface Report {
  id: string
  type: 'stock' | 'sales' | 'expense' | 'occupancy' | 'guest_activity' | 'revenue' | 'complaint'
  manager_name: string
  manager_id: string
  date: string
  status: 'pending' | 'approved' | 'rejected' | 'clarification_requested'
  created_at: string
  amount?: number
}

interface Stats {
  stock: number
  sales: number
  expense: number
  occupancy: number
  guest_activity: number
  revenue: number
  complaint: number
  total_pending: number
  clarification_requested: number
  missing_managers: number
}

interface Manager {
  id: string
  full_name: string
  email: string
  role: 'manager' | 'front_office_manager'
}

export default function BDMDashboard() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<Stats>({ 
    stock: 0, 
    sales: 0, 
    expense: 0,
    occupancy: 0,
    guest_activity: 0,
    revenue: 0,
    complaint: 0,
    total_pending: 0,
    clarification_requested: 0,
    missing_managers: 0
  })
  const [recentReports, setRecentReports] = useState<Report[]>([])
  const [missingManagers, setMissingManagers] = useState<Manager[]>([])

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

    const occupancyChannel = supabase
      .channel('occupancy_reports_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'occupancy_reports' }, () => {
        loadDashboardData()
      })
      .subscribe()

    const guestChannel = supabase
      .channel('guest_activity_reports_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'guest_activity_reports' }, () => {
        loadDashboardData()
      })
      .subscribe()

    const revenueChannel = supabase
      .channel('revenue_reports_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'revenue_reports' }, () => {
        loadDashboardData()
      })
      .subscribe()

    const complaintChannel = supabase
      .channel('complaint_reports_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'complaint_reports' }, () => {
        loadDashboardData()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(stockChannel)
      supabase.removeChannel(salesChannel)
      supabase.removeChannel(expenseChannel)
      supabase.removeChannel(occupancyChannel)
      supabase.removeChannel(guestChannel)
      supabase.removeChannel(revenueChannel)
      supabase.removeChannel(complaintChannel)
    }
  }, [])

  const loadDashboardData = async () => {
    try {
      // Get today's date
      const today = new Date().toISOString().split('T')[0]

      // Fetch ALL managers (both manager and front_office_manager)
      const { data: allManagers } = await supabase
        .from('users')
        .select('id, full_name, email, role')
        .in('role', ['manager', 'front_office_manager'])
        .order('full_name')

      // Fetch reports with user information
      const [stockData, salesData, expenseData, occupancyData, guestData, revenueData, complaintData] = await Promise.all([
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
        supabase
          .from('occupancy_reports')
          .select('*, users!occupancy_reports_manager_id_fkey(full_name)')
          .eq('report_date', today)
          .order('created_at', { ascending: false }),
        supabase
          .from('guest_activity_reports')
          .select('*, users!guest_activity_reports_manager_id_fkey(full_name)')
          .eq('report_date', today)
          .order('created_at', { ascending: false }),
        supabase
          .from('revenue_reports')
          .select('*, users!revenue_reports_manager_id_fkey(full_name)')
          .eq('report_date', today)
          .order('created_at', { ascending: false }),
        supabase
          .from('complaint_reports')
          .select('*, users!complaint_reports_manager_id_fkey(full_name)')
          .eq('report_date', today)
          .order('created_at', { ascending: false }),
      ])

      // Transform data with proper type handling
      const allReports: Report[] = [
        ...(stockData.data || []).map((r: any) => ({
          id: r.id,
          type: 'stock' as const,
          manager_name: r.users?.full_name || 'Unknown',
          manager_id: r.manager_id,
          date: r.report_date,
          status: r.status,
          created_at: r.created_at,
        })),
        ...(salesData.data || []).map((r: any) => ({
          id: r.id,
          type: 'sales' as const,
          manager_name: r.users?.full_name || 'Unknown',
          manager_id: r.manager_id,
          date: r.report_date,
          status: r.status,
          created_at: r.created_at,
          amount: r.total_amount,
        })),
        ...(expenseData.data || []).map((r: any) => ({
          id: r.id,
          type: 'expense' as const,
          manager_name: r.users?.full_name || 'Unknown',
          manager_id: r.manager_id,
          date: r.report_date,
          status: r.status,
          created_at: r.created_at,
        })),
        ...(occupancyData.data || []).map((r: any) => ({
          id: r.id,
          type: 'occupancy' as const,
          manager_name: r.users?.full_name || 'Unknown',
          manager_id: r.manager_id,
          date: r.report_date,
          status: r.status,
          created_at: r.created_at,
        })),
        ...(guestData.data || []).map((r: any) => ({
          id: r.id,
          type: 'guest_activity' as const,
          manager_name: r.users?.full_name || 'Unknown',
          manager_id: r.manager_id,
          date: r.report_date,
          status: r.status,
          created_at: r.created_at,
        })),
        ...(revenueData.data || []).map((r: any) => ({
          id: r.id,
          type: 'revenue' as const,
          manager_name: r.users?.full_name || 'Unknown',
          manager_id: r.manager_id,
          date: r.report_date,
          status: r.status,
          created_at: r.created_at,
          amount: r.total_revenue,
        })),
        ...(complaintData.data || []).map((r: any) => ({
          id: r.id,
          type: 'complaint' as const,
          manager_name: r.users?.full_name || 'Unknown',
          manager_id: r.manager_id,
          date: r.report_date,
          status: r.status,
          created_at: r.created_at,
        })),
      ]

      // Sort by created_at
      allReports.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

      // Find managers who haven't submitted any reports today
      const managersWithReports = new Set(allReports.map((r: any) => r.manager_id))
      const managersWithoutReports = (allManagers || []).filter(
        (manager: Manager) => !managersWithReports.has(manager.id)
      )

      // Calculate stats
      const newStats = {
        stock: stockData.data?.length || 0,
        sales: salesData.data?.length || 0,
        expense: expenseData.data?.length || 0,
        occupancy: occupancyData.data?.length || 0,
        guest_activity: guestData.data?.length || 0,
        revenue: revenueData.data?.length || 0,
        complaint: complaintData.data?.length || 0,
        total_pending: allReports.filter(r => r.status === 'pending').length,
        clarification_requested: allReports.filter(r => r.status === 'clarification_requested').length,
        missing_managers: managersWithoutReports.length,
      }

      setStats(newStats)
      setRecentReports(allReports)
      setMissingManagers(managersWithoutReports)
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
      case 'occupancy':
        return <Hotel className="w-5 h-5" />
      case 'guest_activity':
        return <UserCheck className="w-5 h-5" />
      case 'revenue':
        return <TrendingUp className="w-5 h-5" />
      case 'complaint':
        return <MessageSquare className="w-5 h-5" />
      default:
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
      case 'occupancy':
        return 'Occupancy Report'
      case 'guest_activity':
        return 'Guest Activity Report'
      case 'revenue':
        return 'Revenue Report'
      case 'complaint':
        return 'Complaint Report'
      default:
        return 'Report'
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
      case 'occupancy':
        return 'bg-indigo-500'
      case 'guest_activity':
        return 'bg-pink-500'
      case 'revenue':
        return 'bg-emerald-500'
      case 'complaint':
        return 'bg-red-500'
      default:
        return 'bg-gray-500'
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
              <div className="text-sm font-medium text-gray-600">All Reports Today</div>
              <div className="text-3xl font-bold text-gray-900 mt-2">
                {stats.stock + stats.sales + stats.expense + stats.occupancy + stats.guest_activity + stats.revenue + stats.complaint}
              </div>
            </div>
            <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
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
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-gray-600">Clarifications</div>
              <div className="text-3xl font-bold text-blue-600 mt-2">{stats.clarification_requested}</div>
            </div>
            <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
              <MessageSquare className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
        <div className="card bg-orange-50 border-orange-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-orange-600">Missing Reports</div>
              <div className="text-3xl font-bold text-orange-600 mt-2">{stats.missing_managers}</div>
            </div>
            <div className="w-12 h-12 bg-orange-500 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Missing Reports Warning */}
      {missingManagers.length > 0 && (
        <div className="mb-8 card bg-orange-50 border-orange-200">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-orange-900 mb-2">
                {missingManagers.length} Manager{missingManagers.length > 1 ? 's' : ''} Haven't Submitted Today
              </h3>
              <div className="space-y-1">
                {missingManagers.map((manager: Manager) => (
                  <div key={manager.id} className="flex items-center space-x-2 text-sm text-orange-800">
                    <Users className="w-4 h-4" />
                    <span className="font-medium">{manager.full_name}</span>
                    <span className="text-orange-600">({manager.role === 'front_office_manager' ? 'Front Office' : 'Manager'})</span>
                    <span className="text-orange-500">{manager.email}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Clarification Requests */}
      {stats.clarification_requested > 0 && (
        <div className="mb-8 card bg-blue-50 border-blue-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Clock className="w-5 h-5 text-blue-600" />
              <div>
                <h3 className="text-lg font-semibold text-blue-900">
                  {stats.clarification_requested} Report{stats.clarification_requested > 1 ? 's' : ''} Awaiting Clarification
                </h3>
                <p className="text-sm text-blue-700">Managers are responding to your questions</p>
              </div>
            </div>
            <Link href="/bdm/pending" className="btn-primary">
              View All
            </Link>
          </div>
        </div>
      )}

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
                    <div className={`w-10 h-10 ${getReportColor(report.type)} rounded-lg flex items-center justify-center text-white`}>
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
                        {report.status === 'clarification_requested' && (
                          <>
                            <span className="text-gray-400">•</span>
                            <span className="text-xs font-medium text-blue-600">CLARIFICATION</span>
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
                      {report.status === 'clarification_requested' 
                        ? 'Clarification' 
                        : report.status.charAt(0).toUpperCase() + report.status.slice(1)}
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