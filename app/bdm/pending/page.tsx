'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Package, DollarSign, FileText, Clock, User, Calendar, AlertCircle } from 'lucide-react'
import { format } from 'date-fns'

interface PendingReport {
  id: string
  type: 'stock' | 'sales' | 'expense'
  manager_id: string
  manager_name: string
  report_date: string
  created_at: string
  status: 'pending' | 'clarification_requested'
  total_amount?: number
  notes?: string
  clarification_request?: string
  clarification_response?: string
  clarification_responded_at?: string
}

export default function PendingReportsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [reports, setReports] = useState<PendingReport[]>([])
  const [filter, setFilter] = useState<'all' | 'pending' | 'clarification'>('all')

  useEffect(() => {
    loadPendingReports()
  }, [])

  const loadPendingReports = async () => {
    try {
      const [stockData, salesData, expenseData] = await Promise.all([
        supabase
          .from('stock_reports')
          .select('*, users!stock_reports_manager_id_fkey(full_name)')
          .in('status', ['pending', 'clarification_requested'])
          .order('created_at', { ascending: false }),
        supabase
          .from('sales_reports')
          .select('*, users!sales_reports_manager_id_fkey(full_name)')
          .in('status', ['pending', 'clarification_requested'])
          .order('created_at', { ascending: false }),
        supabase
          .from('expense_reports')
          .select('*, users!expense_reports_manager_id_fkey(full_name)')
          .in('status', ['pending', 'clarification_requested'])
          .order('created_at', { ascending: false }),
      ])

      const allReports: PendingReport[] = [
        ...(stockData.data || []).map((r: any) => ({
          id: r.id,
          type: 'stock' as const,
          manager_id: r.manager_id,
          manager_name: r.users?.full_name || 'Unknown',
          report_date: r.report_date,
          created_at: r.created_at,
          status: r.status,
          notes: r.notes,
          clarification_request: r.clarification_request,
          clarification_response: r.clarification_response,
          clarification_responded_at: r.clarification_responded_at,
        })),
        ...(salesData.data || []).map((r: any) => ({
          id: r.id,
          type: 'sales' as const,
          manager_id: r.manager_id,
          manager_name: r.users?.full_name || 'Unknown',
          report_date: r.report_date,
          created_at: r.created_at,
          status: r.status,
          total_amount: r.total_amount,
          notes: r.notes,
          clarification_request: r.clarification_request,
          clarification_response: r.clarification_response,
          clarification_responded_at: r.clarification_responded_at,
        })),
        ...(expenseData.data || []).map((r: any) => ({
          id: r.id,
          type: 'expense' as const,
          manager_id: r.manager_id,
          manager_name: r.users?.full_name || 'Unknown',
          report_date: r.report_date,
          created_at: r.created_at,
          status: r.status,
          notes: r.notes,
          clarification_request: r.clarification_request,
          clarification_response: r.clarification_response,
          clarification_responded_at: r.clarification_responded_at,
        })),
      ]

      allReports.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      setReports(allReports)
    } catch (error) {
      console.error('Error loading pending reports:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredReports = reports.filter(report => {
    if (filter === 'pending') return report.status === 'pending'
    if (filter === 'clarification') return report.status === 'clarification_requested'
    return true
  })

  const pendingCount = reports.filter(r => r.status === 'pending').length
  const clarificationCount = reports.filter(r => r.status === 'clarification_requested').length

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

  const getReportColor = (type: string) => {
    switch (type) {
      case 'stock':
        return 'bg-blue-50 border-blue-200'
      case 'sales':
        return 'bg-green-50 border-green-200'
      case 'expense':
        return 'bg-purple-50 border-purple-200'
    }
  }

  const handleReviewReport = (report: PendingReport) => {
    router.push(`/bdm/review/${report.type}/${report.id}`)
  }

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
        <p className="text-gray-600 mt-2">Review and approve or reject manager submissions</p>
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
          onClick={() => setFilter('pending')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'pending'
              ? 'bg-yellow-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Pending Review ({pendingCount})
        </button>
        <button
          onClick={() => setFilter('clarification')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'clarification'
              ? 'bg-orange-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Awaiting Clarification ({clarificationCount})
        </button>
      </div>

      {filteredReports.length === 0 ? (
        <div className="card text-center py-12">
          <Clock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Reports</h3>
          <p className="text-gray-600">
            {filter === 'all' && 'All reports have been reviewed'}
            {filter === 'pending' && 'No pending reports to review'}
            {filter === 'clarification' && 'No reports awaiting clarification'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredReports.map((report) => (
            <div
              key={report.id}
              className={`card border-l-4 ${
                report.status === 'clarification_requested' 
                  ? 'border-orange-500 bg-orange-50' 
                  : getReportColor(report.type)
              } hover:shadow-md transition-shadow cursor-pointer`}
              onClick={() => handleReviewReport(report)}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4 flex-1">
                  <div className="mt-1">
                    {getReportIcon(report.type)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {getReportTypeLabel(report.type)}
                      </h3>
                      <span className={`status-badge status-${report.status}`}>
                        {report.status === 'clarification_requested' 
                          ? 'Clarification Requested' 
                          : 'Pending Review'}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                      <div className="flex items-center space-x-2 text-gray-600">
                        <User className="w-4 h-4" />
                        <span>{report.manager_name}</span>
                      </div>
                      <div className="flex items-center space-x-2 text-gray-600">
                        <Calendar className="w-4 h-4" />
                        <span>Report Date: {format(new Date(report.report_date), 'MMM dd, yyyy')}</span>
                      </div>
                      <div className="flex items-center space-x-2 text-gray-600">
                        <Clock className="w-4 h-4" />
                        <span>Submitted: {format(new Date(report.created_at), 'MMM dd, yyyy h:mm a')}</span>
                      </div>
                      {report.total_amount !== undefined && (
                        <div className="text-gray-600">
                          <span className="font-semibold">Amount: ₦{report.total_amount.toFixed(2)}</span>
                        </div>
                      )}
                    </div>

                    {/* Show clarification info if status is clarification_requested */}
                    {report.status === 'clarification_requested' && (
                      <div className="mt-3 space-y-2">
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <div className="flex items-start space-x-2">
                            <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5" />
                            <div className="flex-1">
                              <div className="text-sm font-semibold text-blue-900 mb-1">Your Question:</div>
                              <div className="text-sm text-blue-800">{report.clarification_request}</div>
                            </div>
                          </div>
                        </div>

                        {report.clarification_response ? (
                          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                            <div className="flex items-start space-x-2">
                              <AlertCircle className="w-4 h-4 text-green-600 mt-0.5" />
                              <div className="flex-1">
                                <div className="text-sm font-semibold text-green-900 mb-1">
                                  Manager's Response ({report.clarification_responded_at && format(new Date(report.clarification_responded_at), 'MMM dd, h:mm a')}):
                                </div>
                                <div className="text-sm text-green-800">{report.clarification_response}</div>
                                <div className="mt-2 text-xs text-green-700">
                                  ✓ Click to review and approve/reject
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm text-orange-600 font-medium">
                            ⏳ Waiting for manager's response...
                          </div>
                        )}
                      </div>
                    )}

                    {report.notes && report.status === 'pending' && (
                      <div className="mt-3 text-sm text-gray-600 bg-gray-50 p-3 rounded">
                        <span className="font-medium">Notes:</span> {report.notes}
                      </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleReviewReport(report)
                  }}
                  className="btn-primary ml-4"
                >
                  {report.status === 'clarification_requested' && report.clarification_response 
                    ? 'Review Response' 
                    : 'Review'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}