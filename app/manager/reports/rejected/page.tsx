'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { XCircle, Package, DollarSign, FileText, Calendar, AlertTriangle, CheckCircle, Eye, User } from 'lucide-react'
import { format } from 'date-fns'

interface RejectedReport {
  id: string
  type: 'stock' | 'sales' | 'expense'
  report_date: string
  reviewed_at: string
  reviewed_by_name: string
  rejection_reason: string
  rejection_feedback: string
  resubmission_deadline?: string
  total_amount?: number
  notes?: string
}

export default function ManagerRejectedReportsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [reports, setReports] = useState<RejectedReport[]>([])

  useEffect(() => {
    loadRejectedReports()
  }, [])

  const loadRejectedReports = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [stockData, salesData, expenseData] = await Promise.all([
        supabase
          .from('stock_reports')
          .select('*, reviewer:users!stock_reports_reviewed_by_fkey(full_name)')
          .eq('manager_id', user.id)
          .eq('status', 'rejected')
          .order('reviewed_at', { ascending: false }),
        supabase
          .from('sales_reports')
          .select('*, reviewer:users!sales_reports_reviewed_by_fkey(full_name)')
          .eq('manager_id', user.id)
          .eq('status', 'rejected')
          .order('reviewed_at', { ascending: false }),
        supabase
          .from('expense_reports')
          .select('*, reviewer:users!expense_reports_reviewed_by_fkey(full_name)')
          .eq('manager_id', user.id)
          .eq('status', 'rejected')
          .order('reviewed_at', { ascending: false }),
      ])

      const allReports: RejectedReport[] = [
        ...(stockData.data || []).map((r: any) => ({
          id: r.id,
          type: 'stock' as const,
          report_date: r.report_date,
          reviewed_at: r.reviewed_at,
          reviewed_by_name: r.reviewer?.full_name || 'BDM',
          rejection_reason: r.rejection_reason || 'No reason provided',
          rejection_feedback: r.rejection_feedback || 'No feedback provided',
          resubmission_deadline: r.resubmission_deadline,
          notes: r.notes,
        })),
        ...(salesData.data || []).map((r: any) => ({
          id: r.id,
          type: 'sales' as const,
          report_date: r.report_date,
          reviewed_at: r.reviewed_at,
          reviewed_by_name: r.reviewer?.full_name || 'BDM',
          rejection_reason: r.rejection_reason || 'No reason provided',
          rejection_feedback: r.rejection_feedback || 'No feedback provided',
          resubmission_deadline: r.resubmission_deadline,
          total_amount: r.total_amount,
          notes: r.notes,
        })),
        ...(expenseData.data || []).map((r: any) => ({
          id: r.id,
          type: 'expense' as const,
          report_date: r.report_date,
          reviewed_at: r.reviewed_at,
          reviewed_by_name: r.reviewer?.full_name || 'BDM',
          rejection_reason: r.rejection_reason || 'No reason provided',
          rejection_feedback: r.rejection_feedback || 'No feedback provided',
          resubmission_deadline: r.resubmission_deadline,
          notes: r.notes,
        })),
      ]

      allReports.sort((a, b) => new Date(b.reviewed_at).getTime() - new Date(a.reviewed_at).getTime())
      setReports(allReports)
    } catch (error) {
      console.error('Error loading rejected reports:', error)
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

  const handleViewReport = (report: RejectedReport) => {
    // Navigate to view/edit page
    router.push(`/manager/reports/view/${report.type}/${report.id}`)
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
        <p className="text-gray-600 mt-2">Reports that need corrections and resubmission</p>
      </div>

      {reports.length === 0 ? (
        <div className="card text-center py-12">
          <CheckCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Rejected Reports</h3>
          <p className="text-gray-600">Great! You don't have any rejected reports</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => (
            <div 
              key={report.id} 
              className="card border-l-4 border-red-500 hover:shadow-lg transition-all cursor-pointer"
              onClick={() => handleViewReport(report)}
            >
              <div className="flex items-start space-x-4">
                <div className="mt-1">
                  {getReportIcon(report.type)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-3">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {getReportTypeLabel(report.type)}
                      </h3>
                      <span className="status-badge status-rejected">Rejected</span>
                    </div>
                    <button className="btn-primary flex items-center space-x-2">
                      <Eye className="w-4 h-4" />
                      <span>View Details</span>
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-gray-600 mb-3">
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-4 h-4" />
                      <span>Report: {format(new Date(report.report_date), 'MMM dd, yyyy')}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <XCircle className="w-4 h-4 text-red-600" />
                      <span>Rejected: {format(new Date(report.reviewed_at), 'MMM dd, yyyy')}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <User className="w-4 h-4" />
                      <span>By: {report.reviewed_by_name}</span>
                    </div>
                  </div>

                  {report.resubmission_deadline && (
                    <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex items-center space-x-2 text-sm text-yellow-800">
                        <AlertTriangle className="w-4 h-4" />
                        <span className="font-medium">
                          Resubmit by: {format(new Date(report.resubmission_deadline), 'MMM dd, yyyy')}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-3">
                    <div className="font-semibold text-red-900 mb-2 flex items-center space-x-2">
                      <AlertTriangle className="w-4 h-4" />
                      <span>Rejection Reason: {report.rejection_reason}</span>
                    </div>
                    <div className="text-sm text-red-800">
                      <span className="font-medium">Feedback:</span> {report.rejection_feedback}
                    </div>
                  </div>

                  {report.total_amount !== undefined && (
                    <div className="text-sm text-gray-600 mb-2">
                      <span className="font-semibold">Amount: ₦{report.total_amount.toFixed(2)}</span>
                    </div>
                  )}

                  {report.notes && (
                    <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                      <span className="font-medium">Original Notes:</span> {report.notes}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}