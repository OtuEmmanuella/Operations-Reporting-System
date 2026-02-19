'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Clock, Package, DollarSign, Hotel, Users, TrendingUp, MessageSquare, AlertCircle } from 'lucide-react'
import { format } from 'date-fns'

interface Report {
  id: string
  type: string
  manager_id: string
  manager_name: string
  report_date: string
  created_at: string
  status: string
}

export default function PendingReportsPage() {
  const [loading, setLoading] = useState(true)
  const [reports, setReports] = useState<Report[]>([])
  const [filter, setFilter] = useState<'all' | 'pending' | 'clarification'>('all')

  useEffect(() => {
    loadReports()
  }, [])

  const loadReports = async () => {
    setLoading(true)
    try {
      // Load all report types in parallel
      const [stockReports, salesReports, occupancyReports, guestReports, revenueReports, complaintReports] = await Promise.all([
        supabase.from('stock_inventory_reports').select('*').in('status', ['pending', 'clarification_requested']).order('created_at', { ascending: false }),
        supabase.from('sales_reports').select('*').in('status', ['pending', 'clarification_requested']).order('created_at', { ascending: false }),
        supabase.from('occupancy_reports').select('*').in('status', ['pending', 'clarification_requested']).order('created_at', { ascending: false }),
        supabase.from('guest_activity_reports').select('*').in('status', ['pending', 'clarification_requested']).order('created_at', { ascending: false }),
        supabase.from('revenue_reports').select('*').in('status', ['pending', 'clarification_requested']).order('created_at', { ascending: false }),
        supabase.from('complaint_reports').select('*').in('status', ['pending', 'clarification_requested']).order('created_at', { ascending: false }),
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
            created_at: report.created_at,
            status: report.status,
          }
        })
      )

      // Sort by created_at descending
      reportsWithNames.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

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

  const filteredReports = reports.filter(r => {
    if (filter === 'pending') return r.status === 'pending'
    if (filter === 'clarification') return r.status === 'clarification_requested'
    return true
  })

  const pendingCount = reports.filter(r => r.status === 'pending').length
  const clarificationCount = reports.filter(r => r.status === 'clarification_requested').length

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-lg text-gray-600">Loading pending reports...</div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Pending Reports</h1>
        <p className="text-gray-600 mt-2">Review and approve submitted reports</p>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center space-x-2 mb-6">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'all' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          All ({reports.length})
        </button>
        <button
          onClick={() => setFilter('pending')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'pending' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Pending ({pendingCount})
        </button>
        <button
          onClick={() => setFilter('clarification')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'clarification' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Needs Clarification ({clarificationCount})
        </button>
      </div>

      {/* Reports List */}
      <div className="card">
        {filteredReports.length === 0 ? (
          <div className="text-center py-12">
            <Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 text-lg">No pending reports</p>
            <p className="text-gray-500 text-sm mt-2">All reports have been reviewed</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredReports.map((report) => {
              const Icon = getReportTypeIcon(report.type)
              return (
                <Link
                  key={report.id}
                  href={`/bdm/review/${report.type}/${report.id}`}
                  className="block"
                >
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="flex items-center space-x-4 flex-1">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${getReportTypeColor(report.type)}`}>
                        {Icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="font-semibold text-gray-900">{getReportTypeLabel(report.type)}</span>
                          {report.status === 'clarification_requested' && (
                            <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-medium rounded-full">
                              Needs Clarification
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-600">
                          {report.manager_name} • {format(new Date(report.report_date), 'MMM dd, yyyy')}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Submitted {format(new Date(report.created_at), 'MMM dd, yyyy \'at\' h:mm a')}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <button className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors">
                        Review
                      </button>
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