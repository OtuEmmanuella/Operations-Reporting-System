'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { XCircle, Package, DollarSign, Hotel, Users, TrendingUp, MessageSquare, AlertCircle, Calendar } from 'lucide-react'
import { format, subDays } from 'date-fns'

interface Report {
  id: string
  type: string
  manager_id: string
  manager_name: string
  report_date: string
  reviewed_at: string
  rejection_reason: string
  status: string
}

export default function RejectedReportsPage() {
  const [loading, setLoading] = useState(true)
  const [reports, setReports] = useState<Report[]>([])
  const [dateFilter, setDateFilter] = useState<'7d' | '30d' | 'all'>('30d')

  useEffect(() => {
    loadReports()
  }, [dateFilter])

  const loadReports = async () => {
    setLoading(true)
    try {
      // Calculate date range
      let dateQuery = ''
      if (dateFilter === '7d') {
        dateQuery = format(subDays(new Date(), 7), 'yyyy-MM-dd')
      } else if (dateFilter === '30d') {
        dateQuery = format(subDays(new Date(), 30), 'yyyy-MM-dd')
      }

      // Load all rejected reports
      const fetchReports = async (table: string) => {
        let query = supabase.from(table).select('*').eq('status', 'rejected').order('reviewed_at', { ascending: false })
        if (dateQuery) {
          query = query.gte('report_date', dateQuery)
        }
        return query
      }

      const [stockReports, salesReports, occupancyReports, guestReports, revenueReports, complaintReports] = await Promise.all([
        fetchReports('stock_inventory_reports'),
        fetchReports('sales_reports'),
        fetchReports('occupancy_reports'),
        fetchReports('guest_activity_reports'),
        fetchReports('revenue_reports'),
        fetchReports('complaint_reports'),
      ])

      const allReports = [
        ...(stockReports.data || []).map(r => ({ ...r, type: 'stock_inventory' })),
        ...(salesReports.data || []).map(r => ({ ...r, type: 'sales' })),
        ...(occupancyReports.data || []).map(r => ({ ...r, type: 'occupancy' })),
        ...(guestReports.data || []).map(r => ({ ...r, type: 'guest_activity' })),
        ...(revenueReports.data || []).map(r => ({ ...r, type: 'revenue' })),
        ...(complaintReports.data || []).map(r => ({ ...r, type: 'complaint' })),
      ]

      // Get manager names
      const reportsWithNames = await Promise.all(
        allReports.map(async (report) => {
          const { data: manager } = await supabase
            .from('users')
            .select('full_name')
            .eq('id', report.manager_id)
            .single()

          return {
            id: report.id,
            type: report.type,
            manager_id: report.manager_id,
            manager_name: manager?.full_name || 'Unknown',
            report_date: report.report_date,
            reviewed_at: report.reviewed_at,
            rejection_reason: report.rejection_reason || 'No reason provided',
            status: report.status,
          }
        })
      )

      // Sort by reviewed_at descending
      reportsWithNames.sort((a, b) => new Date(b.reviewed_at).getTime() - new Date(a.reviewed_at).getTime())

      setReports(reportsWithNames)
    } catch (error) {
      console.error('Error loading reports:', error)
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
    return <Icon className="w-5 h-5" />
  }

  const getReportTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      stock_inventory: 'bg-blue-100 text-blue-700',
      sales: 'bg-green-100 text-green-700',
      occupancy: 'bg-purple-100 text-purple-700',
      guest_activity: 'bg-indigo-100 text-indigo-700',
      revenue: 'bg-emerald-100 text-emerald-700',
      complaint: 'bg-orange-100 text-orange-700',
    }
    return colors[type] || 'bg-gray-100 text-gray-700'
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-lg text-gray-600">Loading rejected reports...</div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Rejected Reports</h1>
        <p className="text-gray-600 mt-2">View all rejected reports</p>
      </div>

      {/* Date Filter */}
      <div className="flex items-center space-x-2 mb-6">
        <Calendar className="w-5 h-5 text-gray-500" />
        <span className="text-sm font-medium text-gray-700">Show:</span>
        {[
          { value: '7d' as const, label: 'Last 7 Days' },
          { value: '30d' as const, label: 'Last 30 Days' },
          { value: 'all' as const, label: 'All Time' },
        ].map(option => (
          <button
            key={option.value}
            onClick={() => setDateFilter(option.value)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              dateFilter === option.value ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="card bg-red-50 border-red-200">
          <div className="text-sm font-medium text-gray-600">Total Rejected</div>
          <div className="text-3xl font-bold text-red-600 mt-2">{reports.length}</div>
        </div>
        <div className="card">
          <div className="text-sm font-medium text-gray-600">Store Reports</div>
          <div className="text-2xl font-bold text-gray-900 mt-2">
            {reports.filter(r => ['stock_inventory', 'sales'].includes(r.type)).length}
          </div>
        </div>
        <div className="card">
          <div className="text-sm font-medium text-gray-600">Front Office Reports</div>
          <div className="text-2xl font-bold text-gray-900 mt-2">
            {reports.filter(r => ['occupancy', 'guest_activity', 'revenue', 'complaint'].includes(r.type)).length}
          </div>
        </div>
      </div>

      {/* Reports List */}
      <div className="card">
        {reports.length === 0 ? (
          <div className="text-center py-12">
            <XCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 text-lg">No rejected reports</p>
            <p className="text-gray-500 text-sm mt-2">Rejected reports will appear here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map((report) => {
              const Icon = getReportTypeIcon(report.type)
              return (
                <Link
                  key={report.id}
                  href={`/bdm/review/${report.type}/${report.id}`}
                  className="block"
                >
                  <div className="flex items-start justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors border-l-4 border-red-500">
                    <div className="flex items-start space-x-4 flex-1">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${getReportTypeColor(report.type)} flex-shrink-0`}>
                        {Icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="font-semibold text-gray-900">{getReportTypeLabel(report.type)}</span>
                          <XCircle className="w-4 h-4 text-red-500" />
                        </div>
                        <div className="text-sm text-gray-600 mb-2">
                          {report.manager_name} • {format(new Date(report.report_date), 'MMM dd, yyyy')}
                        </div>
                        <div className="text-xs text-gray-500 mb-2">
                          Rejected {format(new Date(report.reviewed_at), 'MMM dd, yyyy \'at\' h:mm a')}
                        </div>
                        <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                          <span className="font-medium">Reason: </span>
                          {report.rejection_reason}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3 flex-shrink-0 ml-4">
                      <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                        Rejected
                      </span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}