'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { 
  Users, Clock, CheckCircle, XCircle, AlertCircle, 
  TrendingUp, DollarSign, Package, Hotel, MessageSquare,
  ArrowRight, BarChart3
} from 'lucide-react'
import { format, subDays } from 'date-fns'

interface DashboardStats {
  totalReports: number
  pendingReports: number
  approvedReports: number
  rejectedReports: number
  clarificationReports: number
  
  totalManagers: number
  activeManagersToday: number
  
  // Combined revenue (sales + front office revenue)
  totalRevenue: number
  revenueToday: number
  
  avgOccupancy: number
  complaintsUnresolved: number
}

interface RecentActivity {
  id: string
  type: string
  managerName: string
  date: string
  status: string
  created_at: string
}

export default function BDMDashboard() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([])

  useEffect(() => {
    loadDashboard()
  }, [])

  const loadDashboard = async () => {
    setLoading(true)
    try {
      const today = format(new Date(), 'yyyy-MM-dd')
      const last7Days = format(subDays(new Date(), 7), 'yyyy-MM-dd')

      // Load all data in parallel
      const [
        managers,
        stockReports,
        salesReports,
        occupancyReports,
        guestReports,
        revenueReports,
        complaintReports,
      ] = await Promise.all([
        supabase.from('users').select('*').in('role', ['manager', 'front_office_manager']),
        supabase.from('stock_inventory_reports').select('*'),
        supabase.from('sales_reports').select('*'),
        supabase.from('occupancy_reports').select('*'),
        supabase.from('guest_activity_reports').select('*'),
        supabase.from('revenue_reports').select('*'),
        supabase.from('complaint_reports').select('*'),
      ])

      const allReports = [
        ...(stockReports.data || []).map(r => ({ ...r, type: 'stock_inventory' })),
        ...(salesReports.data || []).map(r => ({ ...r, type: 'sales' })),
        ...(occupancyReports.data || []).map(r => ({ ...r, type: 'occupancy' })),
        ...(guestReports.data || []).map(r => ({ ...r, type: 'guest_activity' })),
        ...(revenueReports.data || []).map(r => ({ ...r, type: 'revenue' })),
        ...(complaintReports.data || []).map(r => ({ ...r, type: 'complaint' })),
      ]

      // Calculate stats
      const totalReports = allReports.length
      const pendingReports = allReports.filter(r => r.status === 'pending').length
      const approvedReports = allReports.filter(r => r.status === 'approved').length
      const rejectedReports = allReports.filter(r => r.status === 'rejected').length
      const clarificationReports = allReports.filter(r => r.status === 'clarification_requested').length

      const totalManagers = managers.data?.length || 0
      const activeManagersToday = new Set(
        allReports.filter(r => r.report_date === today).map(r => r.manager_id)
      ).size

      // MERGE SALES + REVENUE for total revenue calculation
      const salesRevenue = (salesReports.data || [])
        .filter(r => r.status === 'approved' && r.report_date >= last7Days)
        .reduce((sum, r) => sum + (r.total_amount || 0), 0)
      
      const frontOfficeRevenue = (revenueReports.data || [])
        .filter(r => r.status === 'approved' && r.report_date >= last7Days)
        .reduce((sum, r) => sum + (r.total_revenue || 0), 0)
      
      const totalRevenue = salesRevenue + frontOfficeRevenue

      const salesToday = (salesReports.data || [])
        .filter(r => r.report_date === today)
        .reduce((sum, r) => sum + (r.total_amount || 0), 0)
      
      const revenueToday = (revenueReports.data || [])
        .filter(r => r.report_date === today)
        .reduce((sum, r) => sum + (r.total_revenue || 0), 0)

      const combinedRevenueToday = salesToday + revenueToday

      // Occupancy
      const recentOccupancy = (occupancyReports.data || [])
        .filter(r => r.report_date >= last7Days)
      const avgOccupancy = recentOccupancy.length > 0
        ? recentOccupancy.reduce((sum, r) => sum + (r.occupancy_percentage || 0), 0) / recentOccupancy.length
        : 0

      // Unresolved complaints
      const complaintsUnresolved = (complaintReports.data || [])
        .filter(r => r.resolution_status !== 'resolved').length

      setStats({
        totalReports,
        pendingReports,
        approvedReports,
        rejectedReports,
        clarificationReports,
        totalManagers,
        activeManagersToday,
        totalRevenue,
        revenueToday: combinedRevenueToday,
        avgOccupancy,
        complaintsUnresolved,
      })

      // Recent activity (last 10 reports)
      const recentWithManagers = await Promise.all(
        allReports.slice(0, 10).map(async (report) => {
          const { data: manager } = await supabase
            .from('users')
            .select('full_name')
            .eq('id', report.manager_id)
            .single()

          return {
            id: report.id,
            type: report.type,
            managerName: manager?.full_name || 'Unknown',
            date: report.report_date,
            status: report.status,
            created_at: report.created_at,
          }
        })
      )

      setRecentActivity(recentWithManagers.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ))

    } catch (error) {
      console.error('Error loading dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  const getReportTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      stock_inventory: 'Stock & Inventory',
      sales: 'Sales',
      occupancy: 'Occupancy',
      guest_activity: 'Guest Activity',
      revenue: 'Revenue',
      complaint: 'Complaint',
    }
    return labels[type] || type
  }

  const getReportTypeIcon = (type: string) => {
    const icons: Record<string, any> = {
      stock_inventory: Package,
      sales: DollarSign,
      occupancy: Hotel,
      guest_activity: Users,
      revenue: TrendingUp,
      complaint: MessageSquare,
    }
    const Icon = icons[type] || AlertCircle
    return <Icon className="w-4 h-4" />
  }

  if (loading || !stats) {
    return (
      <div className="p-8">
        <div className="text-lg text-gray-600">Loading dashboard...</div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Business Development Dashboard</h1>
        <p className="text-gray-600 mt-2">Monitor all operations and reports</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="card bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium text-gray-600">Pending Reports</div>
            <Clock className="w-5 h-5 text-blue-500" />
          </div>
          <div className="text-3xl font-bold text-gray-900">{stats.pendingReports}</div>
          {stats.clarificationReports > 0 && (
            <div className="text-xs text-orange-600 mt-1">
              {stats.clarificationReports} need clarification
            </div>
          )}
        </div>

        <div className="card bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium text-gray-600">Total Revenue (7d)</div>
            <DollarSign className="w-5 h-5 text-green-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900">
            ₦{stats.totalRevenue.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
          </div>
          <div className="text-xs text-gray-600 mt-1">
            Today: ₦{stats.revenueToday.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
          </div>
        </div>

        <div className="card bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium text-gray-600">Avg Occupancy</div>
            <Hotel className="w-5 h-5 text-purple-500" />
          </div>
          <div className="text-3xl font-bold text-gray-900">
            {stats.avgOccupancy.toFixed(1)}%
          </div>
          <div className="text-xs text-gray-600 mt-1">Last 7 days</div>
        </div>

        <div className="card bg-gradient-to-br from-orange-50 to-red-50 border-orange-200">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium text-gray-600">Active Managers</div>
            <Users className="w-5 h-5 text-orange-500" />
          </div>
          <div className="text-3xl font-bold text-gray-900">
            {stats.activeManagersToday}/{stats.totalManagers}
          </div>
          <div className="text-xs text-gray-600 mt-1">Submitted today</div>
        </div>
      </div>

      {/* Report Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="card">
          <div className="text-sm font-medium text-gray-600">Total Reports</div>
          <div className="text-2xl font-bold text-gray-900 mt-2">{stats.totalReports}</div>
        </div>
        <div className="card">
          <div className="text-sm font-medium text-gray-600">Approved</div>
          <div className="text-2xl font-bold text-success mt-2">{stats.approvedReports}</div>
        </div>
        <div className="card">
          <div className="text-sm font-medium text-gray-600">Rejected</div>
          <div className="text-2xl font-bold text-danger mt-2">{stats.rejectedReports}</div>
        </div>
        <div className="card">
          <div className="text-sm font-medium text-gray-600">Unresolved Complaints</div>
          <div className="text-2xl font-bold text-warning mt-2">{stats.complaintsUnresolved}</div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Link href="/bdm/pending" className="card hover:shadow-lg transition-all">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center">
              <Clock className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <div className="font-semibold text-gray-900">Review Pending</div>
              <div className="text-sm text-gray-600">{stats.pendingReports} reports waiting</div>
            </div>
            <ArrowRight className="w-5 h-5 text-gray-400" />
          </div>
        </Link>

        <Link href="/bdm/managers" className="card hover:shadow-lg transition-all">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-purple-500 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <div className="font-semibold text-gray-900">View Managers</div>
              <div className="text-sm text-gray-600">{stats.totalManagers} total managers</div>
            </div>
            <ArrowRight className="w-5 h-5 text-gray-400" />
          </div>
        </Link>

        <Link href="/bdm/analytics" className="card hover:shadow-lg transition-all">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <div className="font-semibold text-gray-900">Analytics</div>
              <div className="text-sm text-gray-600">Performance insights</div>
            </div>
            <ArrowRight className="w-5 h-5 text-gray-400" />
          </div>
        </Link>
      </div>

      {/* Recent Activity */}
      <div className="card">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Activity</h2>
        {recentActivity.length === 0 ? (
          <p className="text-gray-600 text-center py-8">No recent activity</p>
        ) : (
          <div className="space-y-3">
            {recentActivity.map((activity) => (
              <div
                key={activity.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center space-x-3 flex-1">
                  <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
                    {getReportTypeIcon(activity.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900">
                      {activity.managerName}
                    </div>
                    <div className="text-sm text-gray-600">
                      {getReportTypeLabel(activity.type)} • {format(new Date(activity.date), 'MMM dd, yyyy')}
                    </div>
                  </div>
                </div>
                <span className={`status-badge status-${activity.status} flex-shrink-0`}>
                  {activity.status === 'pending' && <Clock className="w-3 h-3 mr-1" />}
                  {activity.status === 'approved' && <CheckCircle className="w-3 h-3 mr-1" />}
                  {activity.status === 'rejected' && <XCircle className="w-3 h-3 mr-1" />}
                  {activity.status === 'clarification_requested' && <AlertCircle className="w-3 h-3 mr-1" />}
                  {activity.status.charAt(0).toUpperCase() + activity.status.slice(1)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}