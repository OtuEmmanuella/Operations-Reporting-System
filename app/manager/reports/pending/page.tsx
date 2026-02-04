'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Clock, Package, DollarSign, FileText, Calendar, Eye, AlertCircle } from 'lucide-react'
import { format } from 'date-fns'

interface PendingReport {
  id: string
  type: 'stock' | 'sales' | 'expense'
  report_date: string
  created_at: string
  status: 'pending' | 'clarification_requested'
  total_amount?: number
  notes?: string
  clarification_request?: string
  clarification_response?: string
  clarification_responded_at?: string
}

export default function ManagerPendingReportsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [reports, setReports] = useState<PendingReport[]>([])

  useEffect(() => {
    loadPendingReports()
  }, [])

  const loadPendingReports = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Get both pending AND clarification_requested reports
      const [stockData, salesData, expenseData] = await Promise.all([
        supabase
          .from('stock_reports')
          .select('*')
          .eq('manager_id', user.id)
          .in('status', ['pending', 'clarification_requested'])
          .order('created_at', { ascending: false }),
        supabase
          .from('sales_reports')
          .select('*')
          .eq('manager_id', user.id)
          .in('status', ['pending', 'clarification_requested'])
          .order('created_at', { ascending: false }),
        supabase
          .from('expense_reports')
          .select('*')
          .eq('manager_id', user.id)
          .in('status', ['pending', 'clarification_requested'])
          .order('created_at', { ascending: false }),
      ])

      const allReports: PendingReport[] = [
        ...(stockData.data || []).map((r: any) => ({
          id: r.id,
          type: 'stock' as const,
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

  const handleViewReport = (report: PendingReport) => {
    router.push(`/manager/reports/view/${report.type}/${report.id}`)
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-lg text-gray-600">Loading pending reports...</div>
      </div>
    )
  }

  const pendingCount = reports.filter(r => r.status === 'pending').length
  const clarificationCount = reports.filter(r => r.status === 'clarification_requested').length

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Pending Reports</h1>
        <p className="text-gray-600 mt-2">Reports awaiting BDM review or needing clarification</p>
      </div>

      {/* Stats */}
      {clarificationCount > 0 && (
        <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
          <div className="flex items-center space-x-3">
            <AlertCircle className="w-5 h-5 text-orange-600" />
            <div>
              <div className="font-semibold text-orange-900">
                {clarificationCount} Report{clarificationCount > 1 ? 's' : ''} Need{clarificationCount === 1 ? 's' : ''} Your Response
              </div>
              <div className="text-sm text-orange-700">
                BDM has requested clarification. Click to view and respond.
              </div>
            </div>
          </div>
        </div>
      )}

      {reports.length === 0 ? (
        <div className="card text-center py-12">
          <Clock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Pending Reports</h3>
          <p className="text-gray-600">You don't have any reports waiting for review</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => (
            <div 
              key={report.id} 
              className={`card hover:shadow-lg transition-all cursor-pointer border-l-4 ${
                report.status === 'clarification_requested' 
                  ? 'border-orange-500 bg-orange-50' 
                  : 'border-yellow-500'
              }`}
              onClick={() => handleViewReport(report)}
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
                    
                    <div className="flex items-center space-x-4 text-sm text-gray-600 mb-2">
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-4 h-4" />
                        <span>Report Date: {format(new Date(report.report_date), 'MMM dd, yyyy')}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Clock className="w-4 h-4" />
                        <span>Submitted: {format(new Date(report.created_at), 'MMM dd, yyyy h:mm a')}</span>
                      </div>
                    </div>

                    {report.total_amount !== undefined && (
                      <div className="mb-2 text-sm text-gray-600">
                        <span className="font-semibold">Amount: ₦{report.total_amount.toFixed(2)}</span>
                      </div>
                    )}

                    {/* Show clarification preview */}
                    {report.status === 'clarification_requested' && report.clarification_request && (
                      <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <div className="flex items-start space-x-2">
                          <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5" />
                          <div className="flex-1">
                            <div className="text-sm font-semibold text-blue-900 mb-1">BDM's Question:</div>
                            <div className="text-sm text-blue-800 line-clamp-2">{report.clarification_request}</div>
                            {report.clarification_response ? (
                              <div className="mt-2 text-xs text-green-700 font-medium">
                                ✓ You responded on {format(new Date(report.clarification_responded_at!), 'MMM dd, h:mm a')}
                              </div>
                            ) : (
                              <div className="mt-2 text-xs text-orange-700 font-medium">
                                ⏳ Click to view full question and respond
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {report.notes && report.status === 'pending' && (
                      <div className="mt-3 text-sm text-gray-600 bg-gray-50 p-3 rounded">
                        <span className="font-medium">Notes:</span> {report.notes}
                      </div>
                    )}
                  </div>
                </div>
                <button className="btn-primary flex items-center space-x-2 flex-shrink-0">
                  <Eye className="w-4 h-4" />
                  <span>{report.status === 'clarification_requested' ? 'Respond' : 'View'}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}