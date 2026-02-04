'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'
import { CheckCircle, User, ChevronDown, ChevronUp, Package, DollarSign, FileText, Calendar, Eye } from 'lucide-react'
import { format } from 'date-fns'

type StockReport = Database['public']['Tables']['stock_reports']['Row']
type SalesReport = Database['public']['Tables']['sales_reports']['Row']
type ExpenseReport = Database['public']['Tables']['expense_reports']['Row']

interface Manager {
  id: string
  full_name: string
  email: string
}

interface ApprovedReport {
  id: string
  type: 'stock' | 'sales' | 'expense'
  report_date: string
  approved_at: string
  total_amount?: number
  notes?: string
}

export default function ApprovedReportsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [managers, setManagers] = useState<Manager[]>([])
  const [selectedManager, setSelectedManager] = useState<string | null>(null)
  const [reports, setReports] = useState<ApprovedReport[]>([])
  const [expandedManager, setExpandedManager] = useState<string | null>(null)

  useEffect(() => {
    loadManagers()
  }, [])

  useEffect(() => {
    if (selectedManager) {
      loadManagerReports(selectedManager)
    } else {
      setReports([])
    }
  }, [selectedManager])

  const loadManagers = async () => {
    try {
      const { data: allManagers, error: managersError } = await supabase
        .from('users')
        .select('id, full_name, email')
        .eq('role', 'manager')
        .order('full_name')

      if (managersError) {
        console.error('Error loading managers:', managersError)
        return
      }

      if (!allManagers || allManagers.length === 0) {
        setManagers([])
        setLoading(false)
        return
      }

      const managersWithReports: Manager[] = []
      
      for (const manager of allManagers) {
        const [stockCount, salesCount, expenseCount] = await Promise.all([
          supabase
            .from('stock_reports')
            .select('id', { count: 'exact', head: true })
            .eq('manager_id', manager.id)
            .eq('status', 'approved'),
          supabase
            .from('sales_reports')
            .select('id', { count: 'exact', head: true })
            .eq('manager_id', manager.id)
            .eq('status', 'approved'),
          supabase
            .from('expense_reports')
            .select('id', { count: 'exact', head: true })
            .eq('manager_id', manager.id)
            .eq('status', 'approved'),
        ])

        const totalApproved = (stockCount.count || 0) + (salesCount.count || 0) + (expenseCount.count || 0)
        
        if (totalApproved > 0) {
          managersWithReports.push(manager)
        }
      }

      setManagers(managersWithReports)
    } catch (error) {
      console.error('Error loading managers:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadManagerReports = async (managerId: string) => {
    try {
      const [stockData, salesData, expenseData] = await Promise.all([
        supabase
          .from('stock_reports')
          .select('*')
          .eq('manager_id', managerId)
          .eq('status', 'approved')
          .order('reviewed_at', { ascending: false }),
        supabase
          .from('sales_reports')
          .select('*')
          .eq('manager_id', managerId)
          .eq('status', 'approved')
          .order('reviewed_at', { ascending: false }),
        supabase
          .from('expense_reports')
          .select('*')
          .eq('manager_id', managerId)
          .eq('status', 'approved')
          .order('reviewed_at', { ascending: false }),
      ])

      const allReports: ApprovedReport[] = [
        ...(stockData.data || []).map((r: StockReport) => ({
          id: r.id,
          type: 'stock' as const,
          report_date: r.report_date,
          approved_at: r.reviewed_at || '',
          notes: r.notes || undefined,
        })),
        ...(salesData.data || []).map((r: SalesReport) => ({
          id: r.id,
          type: 'sales' as const,
          report_date: r.report_date,
          approved_at: r.reviewed_at || '',
          total_amount: r.total_amount || undefined,
          notes: r.notes || undefined,
        })),
        ...(expenseData.data || []).map((r: ExpenseReport) => ({
          id: r.id,
          type: 'expense' as const,
          report_date: r.report_date,
          approved_at: r.reviewed_at || '',
          notes: r.notes || undefined,
        })),
      ]

      allReports.sort((a, b) => new Date(b.approved_at).getTime() - new Date(a.approved_at).getTime())
      setReports(allReports)
    } catch (error) {
      console.error('Error loading reports:', error)
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

  const handleViewReport = (report: ApprovedReport) => {
    router.push(`/bdm/review/${report.type}/${report.id}`)
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-lg text-gray-600">Loading approved reports...</div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Approved Reports</h1>
        <p className="text-gray-600 mt-2">View all approved reports by manager</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Managers List */}
        <div className="lg:col-span-1">
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Managers ({managers.length})
            </h2>
            <div className="space-y-2">
              {managers.length === 0 ? (
                <div className="text-center py-8">
                  <User className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600 text-sm">No managers with approved reports</p>
                </div>
              ) : (
                managers.map((manager) => (
                  <button
                    key={manager.id}
                    onClick={() => {
                      setSelectedManager(manager.id)
                      setExpandedManager(manager.id === expandedManager ? null : manager.id)
                    }}
                    className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                      selectedManager === manager.id
                        ? 'bg-primary text-white'
                        : 'bg-gray-50 hover:bg-gray-100 text-gray-900'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <User className="w-5 h-5" />
                        <div>
                          <div className="font-medium">{manager.full_name}</div>
                          <div className={`text-xs ${selectedManager === manager.id ? 'text-white/80' : 'text-gray-500'}`}>
                            {manager.email}
                          </div>
                        </div>
                      </div>
                      {expandedManager === manager.id ? (
                        <ChevronUp className="w-5 h-5" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Reports List */}
        <div className="lg:col-span-2">
          {!selectedManager ? (
            <div className="card text-center py-12">
              <User className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Select a Manager</h3>
              <p className="text-gray-600">Choose a manager from the list to view their approved reports</p>
            </div>
          ) : reports.length === 0 ? (
            <div className="card text-center py-12">
              <CheckCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Approved Reports</h3>
              <p className="text-gray-600">This manager has no approved reports yet</p>
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
                      <div className="mt-1">
                        {getReportIcon(report.type)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {getReportTypeLabel(report.type)}
                          </h3>
                          <span className="status-badge status-approved">Approved</span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div className="flex items-center space-x-2 text-gray-600">
                            <Calendar className="w-4 h-4" />
                            <span>Report: {format(new Date(report.report_date), 'MMM dd, yyyy')}</span>
                          </div>
                          <div className="flex items-center space-x-2 text-gray-600">
                            <CheckCircle className="w-4 h-4" />
                            <span>Approved: {format(new Date(report.approved_at), 'MMM dd, yyyy')}</span>
                          </div>
                          {report.total_amount !== undefined && (
                            <div className="text-gray-600 col-span-2">
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
                    <button className="btn-primary flex items-center space-x-2">
                      <Eye className="w-4 h-4" />
                      <span>View</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}