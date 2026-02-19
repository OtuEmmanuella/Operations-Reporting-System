'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { CheckCircle, Package, DollarSign, FileText, Calendar, Eye, User } from 'lucide-react'
import { format } from 'date-fns'

interface ApprovedReport {
  id: string
  type: 'stock' | 'sales' | 'expense'
  report_date: string
  reviewed_at: string
  reviewed_by_name: string
  total_amount?: number
  notes?: string
}

export default function ManagerApprovedReportsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [reports, setReports] = useState<ApprovedReport[]>([])

  useEffect(() => {
    loadApprovedReports()
  }, [])

  const loadApprovedReports = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [stockData, salesData, expenseData] = await Promise.all([
        supabase
          .from('stock_inventory_reports')
          .select('*, reviewer:users!stock_inventory_reports_reviewed_by_fkey(full_name)')
          .eq('manager_id', user.id)
          .eq('status', 'approved')
          .order('reviewed_at', { ascending: false }),
        supabase
          .from('sales_reports')
          .select('*, reviewer:users!sales_reports_reviewed_by_fkey(full_name)')
          .eq('manager_id', user.id)
          .eq('status', 'approved')
          .order('reviewed_at', { ascending: false }),
        supabase
          .from('expense_reports')
          .select('*, reviewer:users!expense_reports_reviewed_by_fkey(full_name)')
          .eq('manager_id', user.id)
          .eq('status', 'approved')
          .order('reviewed_at', { ascending: false }),
      ])

      const allReports: ApprovedReport[] = [
        ...(stockData.data || []).map((r: any) => ({
          id: r.id,
          type: 'stock' as const,
          report_date: r.report_date,
          reviewed_at: r.reviewed_at,
          reviewed_by_name: r.reviewer?.full_name || 'BDM',
          notes: r.notes,
        })),
        ...(salesData.data || []).map((r: any) => ({
          id: r.id,
          type: 'sales' as const,
          report_date: r.report_date,
          reviewed_at: r.reviewed_at,
          reviewed_by_name: r.reviewer?.full_name || 'BDM',
          total_amount: r.total_amount,
          notes: r.notes,
        })),
        ...(expenseData.data || []).map((r: any) => ({
          id: r.id,
          type: 'expense' as const,
          report_date: r.report_date,
          reviewed_at: r.reviewed_at,
          reviewed_by_name: r.reviewer?.full_name || 'BDM',
          notes: r.notes,
        })),
      ]

      allReports.sort((a, b) => new Date(b.reviewed_at).getTime() - new Date(a.reviewed_at).getTime())
      setReports(allReports)
    } catch (error) {
      console.error('Error loading approved reports:', error)
    } finally {
      setLoading(false)
    }
  }

  const getReportIcon = (type: string) => {
    switch (type) {
      case 'stock': return <Package className="w-5 h-5 text-blue-500" />
      case 'sales': return <DollarSign className="w-5 h-5 text-green-500" />
      case 'expense': return <FileText className="w-5 h-5 text-purple-500" />
    }
  }

  const getReportTypeLabel = (type: string) => {
    switch (type) {
      case 'stock': return 'Stock & Inventory Report'
      case 'sales': return 'Sales Report'
      case 'expense': return 'Expense Report'
    }
  }

  // THE FIX: ?source=approved tells the view page to show "Back to Approved Reports"
  const handleViewReport = (report: ApprovedReport) => {
    router.push(`/manager/reports/view/${report.type}/${report.id}?source=approved`)
  }

  if (loading) {
    return <div className="p-8"><div className="text-lg text-gray-600">Loading approved reports...</div></div>
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Approved Reports</h1>
        <p className="text-gray-600 mt-2">Reports that have been approved by BDM</p>
      </div>

      {reports.length === 0 ? (
        <div className="card text-center py-12">
          <CheckCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Approved Reports</h3>
          <p className="text-gray-600">You don't have any approved reports yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => (
            <div
              key={report.id}
              className="card hover:shadow-lg transition-all cursor-pointer border-l-4 border-green-500"
              onClick={() => handleViewReport(report)}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4 flex-1">
                  <div className="mt-1">{getReportIcon(report.type)}</div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">{getReportTypeLabel(report.type)}</h3>
                      <span className="status-badge status-approved">Approved</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-gray-600">
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-4 h-4" />
                        <span>Report: {format(new Date(report.report_date), 'MMM dd, yyyy')}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span>Approved: {format(new Date(report.reviewed_at), 'MMM dd, yyyy')}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <User className="w-4 h-4" />
                        <span>By: {report.reviewed_by_name}</span>
                      </div>
                    </div>

                    {report.total_amount !== undefined && (
                      <div className="mt-2 text-sm text-gray-600">
                        <span className="font-semibold">Amount: ₦{report.total_amount.toFixed(2)}</span>
                      </div>
                    )}

                    {report.notes && (
                      <div className="mt-3 text-sm text-gray-600 bg-gray-50 p-3 rounded">
                        <span className="font-medium">Notes:</span> {report.notes}
                      </div>
                    )}
                  </div>
                </div>
                <button className="btn-primary flex items-center space-x-2 flex-shrink-0">
                  <Eye className="w-4 h-4" />
                  <span>View Details</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}