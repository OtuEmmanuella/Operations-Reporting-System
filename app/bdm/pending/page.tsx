'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Package, DollarSign, FileText, Clock, User, Calendar } from 'lucide-react'
import { format } from 'date-fns'

interface PendingReport {
  id: string
  type: 'stock' | 'sales' | 'expense'
  manager_id: string
  manager_name: string
  report_date: string
  created_at: string
  total_amount?: number
  notes?: string
}

export default function PendingReportsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [reports, setReports] = useState<PendingReport[]>([])

  useEffect(() => {
    loadPendingReports()
  }, [])

  const loadPendingReports = async () => {
    try {
      const [stockData, salesData, expenseData] = await Promise.all([
        supabase
          .from('stock_reports')
          .select('*, users!stock_reports_manager_id_fkey(full_name)')
          .eq('status', 'pending')
          .order('created_at', { ascending: false }),
        supabase
          .from('sales_reports')
          .select('*, users!sales_reports_manager_id_fkey(full_name)')
          .eq('status', 'pending')
          .order('created_at', { ascending: false }),
        supabase
          .from('expense_reports')
          .select('*, users!expense_reports_manager_id_fkey(full_name)')
          .eq('status', 'pending')
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
          notes: r.notes,
        })),
        ...(salesData.data || []).map((r: any) => ({
          id: r.id,
          type: 'sales' as const,
          manager_id: r.manager_id,
          manager_name: r.users?.full_name || 'Unknown',
          report_date: r.report_date,
          created_at: r.created_at,
          total_amount: r.total_amount,
          notes: r.notes,
        })),
        ...(expenseData.data || []).map((r: any) => ({
          id: r.id,
          type: 'expense' as const,
          manager_id: r.manager_id,
          manager_name: r.users?.full_name || 'Unknown',
          report_date: r.report_date,
          created_at: r.created_at,
          total_amount: r.total_amount,
          notes: r.notes,
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

      {reports.length === 0 ? (
        <div className="card text-center py-12">
          <Clock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Pending Reports</h3>
          <p className="text-gray-600">All reports have been reviewed</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => (
            <div
              key={report.id}
              className={`card border-l-4 ${getReportColor(report.type)} hover:shadow-md transition-shadow cursor-pointer`}
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
                      <span className="status-badge status-pending">Pending Review</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
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

                    {report.notes && (
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
                  Review
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}