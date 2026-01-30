'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { XCircle, Package, DollarSign, FileText, Calendar, User, Clock, AlertTriangle } from 'lucide-react'
import { format, isPast, parseISO } from 'date-fns'

interface RejectedReport {
  id: string
  type: 'stock' | 'sales' | 'expense'
  manager_id: string
  manager_name: string
  report_date: string
  rejected_at: string
  rejection_reason: string
  rejection_feedback: string
  resubmission_deadline: string | null
  total_amount?: number
  notes?: string
  is_overdue: boolean
}

export default function RejectedReportsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [reports, setReports] = useState<RejectedReport[]>([])
  const [filter, setFilter] = useState<'all' | 'overdue' | 'pending'>('all')

  useEffect(() => {
    loadRejectedReports()
  }, [])

  const loadRejectedReports = async () => {
    try {
      const [stockData, salesData, expenseData] = await Promise.all([
        supabase
          .from('stock_reports')
          .select('*, users!stock_reports_manager_id_fkey(full_name)')
          .eq('status', 'rejected')
          .order('reviewed_at', { ascending: false }),
        supabase
          .from('sales_reports')
          .select('*, users!sales_reports_manager_id_fkey(full_name)')
          .eq('status', 'rejected')
          .order('reviewed_at', { ascending: false }),
        supabase
          .from('expense_reports')
          .select('*, users!expense_reports_manager_id_fkey(full_name)')
          .eq('status', 'rejected')
          .order('reviewed_at', { ascending: false }),
      ])

      const allReports: RejectedReport[] = [
        ...(stockData.data || []).map((r: any) => ({
          id: r.id,
          type: 'stock' as const,
          manager_id: r.manager_id,
          manager_name: r.users?.full_name || 'Unknown',
          report_date: r.report_date,
          rejected_at: r.reviewed_at,
          rejection_reason: r.rejection_reason || 'No reason provided',
          rejection_feedback: r.rejection_feedback || 'No feedback provided',
          resubmission_deadline: r.resubmission_deadline,
          notes: r.notes,
          is_overdue: r.resubmission_deadline ? isPast(parseISO(r.resubmission_deadline)) : false,
        })),
        ...(salesData.data || []).map((r: any) => ({
          id: r.id,
          type: 'sales' as const,
          manager_id: r.manager_id,
          manager_name: r.users?.full_name || 'Unknown',
          report_date: r.report_date,
          rejected_at: r.reviewed_at,
          rejection_reason: r.rejection_reason || 'No reason provided',
          rejection_feedback: r.rejection_feedback || 'No feedback provided',
          resubmission_deadline: r.resubmission_deadline,
          total_amount: r.total_amount,
          notes: r.notes,
          is_overdue: r.resubmission_deadline ? isPast(parseISO(r.resubmission_deadline)) : false,
        })),
        ...(expenseData.data || []).map((r: any) => ({
          id: r.id,
          type: 'expense' as const,
          manager_id: r.manager_id,
          manager_name: r.users?.full_name || 'Unknown',
          report_date: r.report_date,
          rejected_at: r.reviewed_at,
          rejection_reason: r.rejection_reason || 'No reason provided',
          rejection_feedback: r.rejection_feedback || 'No feedback provided',
          resubmission_deadline: r.resubmission_deadline,
          total_amount: r.total_amount,
          notes: r.notes,
          is_overdue: r.resubmission_deadline ? isPast(parseISO(r.resubmission_deadline)) : false,
        })),
      ]

      allReports.sort((a, b) => new Date(b.rejected_at).getTime() - new Date(a.rejected_at).getTime())
      setReports(allReports)
    } catch (error) {
      console.error('Error loading rejected reports:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredReports = reports.filter(report => {
    if (filter === 'overdue') return report.is_overdue
    if (filter === 'pending') return !report.is_overdue && report.resubmission_deadline
    return true
  })

  const getReportIcon = (type: string) => {
    switch (type) {
      case 'stock':
        return <Package className="w-5 h-5 text-blue-500" />
      case 'sales':
        return <DollarSign className="w-5 h-5 text-green-500" />
      case 'expense':
        return <FileText className="w-5 h-5 text-purple-500" />
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

  const handleViewReport = (report: RejectedReport) => {
    router.push(`/bdm/review/${report.type}/${report.id}`)
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-lg text-gray-600">Loading rejected reports...</div>
      </div>
    )
  }

  const overdueCount = reports.filter(r => r.is_overdue).length
  const pendingResubmissionCount = reports.filter(r => !r.is_overdue && r.resubmission_deadline).length

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Rejected Reports</h1>
        <p className="text-gray-600 mt-2">Monitor rejected reports and resubmission deadlines</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="card">
          <div className="text-sm font-medium text-gray-600">Total Rejected</div>
          <div className="text-3xl font-bold text-gray-900 mt-2">{reports.length}</div>
        </div>
        <div className="card bg-red-50 border-red-200">
          <div className="text-sm font-medium text-red-600">Overdue Resubmissions</div>
          <div className="text-3xl font-bold text-red-600 mt-2">{overdueCount}</div>
        </div>
        <div className="card bg-yellow-50 border-yellow-200">
          <div className="text-sm font-medium text-yellow-600">Pending Resubmission</div>
          <div className="text-3xl font-bold text-yellow-600 mt-2">{pendingResubmissionCount}</div>
        </div>
      </div>

      {/* Filter Buttons */}
      <div className="flex space-x-4 mb-6">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'all'
              ? 'bg-primary text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          All ({reports.length})
        </button>
        <button
          onClick={() => setFilter('overdue')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'overdue'
              ? 'bg-red-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Overdue ({overdueCount})
        </button>
        <button
          onClick={() => setFilter('pending')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'pending'
              ? 'bg-yellow-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Pending Resubmission ({pendingResubmissionCount})
        </button>
      </div>

      {/* Reports List */}
      {filteredReports.length === 0 ? (
        <div className="card text-center py-12">
          <XCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Rejected Reports</h3>
          <p className="text-gray-600">
            {filter === 'all' && 'No reports have been rejected'}
            {filter === 'overdue' && 'No overdue resubmissions'}
            {filter === 'pending' && 'No pending resubmissions'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredReports.map((report) => (
            <div
              key={report.id}
              className={`card border-l-4 ${
                report.is_overdue ? 'border-red-500 bg-red-50' : 'border-yellow-500 bg-yellow-50'
              }`}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start space-x-4 flex-1">
                  <div className="mt-1">
                    {getReportIcon(report.type)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {getReportTypeLabel(report.type)}
                      </h3>
                      <span className="status-badge status-rejected">Rejected</span>
                      {report.is_overdue && (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                          <AlertTriangle className="w-4 h-4 mr-1" />
                          Overdue
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Report Info Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
                <div className="flex items-center space-x-2 text-gray-600">
                  <User className="w-4 h-4" />
                  <span>{report.manager_name}</span>
                </div>
                <div className="flex items-center space-x-2 text-gray-600">
                  <Calendar className="w-4 h-4" />
                  <span>Report: {format(new Date(report.report_date), 'MMM dd, yyyy')}</span>
                </div>
                <div className="flex items-center space-x-2 text-gray-600">
                  <XCircle className="w-4 h-4" />
                  <span>Rejected: {format(new Date(report.rejected_at), 'MMM dd, yyyy h:mm a')}</span>
                </div>
                {report.resubmission_deadline && (
                  <div className={`flex items-center space-x-2 ${report.is_overdue ? 'text-red-600 font-semibold' : 'text-yellow-600 font-semibold'}`}>
                    <Clock className="w-4 h-4" />
                    <span>Due: {format(new Date(report.resubmission_deadline), 'MMM dd, yyyy')}</span>
                  </div>
                )}
              </div>

              {report.total_amount !== undefined && (
                <div className="mb-4 text-sm text-gray-600">
                  <span className="font-semibold">Amount: ₦{report.total_amount.toFixed(2)}</span>
                </div>
              )}

              {/* Rejection Details */}
              <div className="space-y-3 mb-4">
                <div className="bg-white p-4 rounded-lg">
                  <div className="text-sm font-semibold text-red-600 mb-2 flex items-center">
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    Rejection Reason:
                  </div>
                  <div className="text-sm text-gray-700">{report.rejection_reason}</div>
                </div>

                <div className="bg-white p-4 rounded-lg">
                  <div className="text-sm font-semibold text-gray-700 mb-2">Instructions to Manager:</div>
                  <div className="text-sm text-gray-700">{report.rejection_feedback}</div>
                </div>

                {report.notes && (
                  <div className="bg-white p-4 rounded-lg">
                    <div className="text-sm font-semibold text-gray-700 mb-2">Original Notes:</div>
                    <div className="text-sm text-gray-700">{report.notes}</div>
                  </div>
                )}
              </div>

              {/* Action Button */}
              <div className="flex justify-end">
                <button
                  onClick={() => handleViewReport(report)}
                  className="btn-primary"
                >
                  View Full Report
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  ) 
}