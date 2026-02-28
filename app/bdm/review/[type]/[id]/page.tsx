'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase, ClarificationMessage } from '@/lib/supabase'
import {
  ArrowLeft, CheckCircle, XCircle, AlertCircle, Calendar, User, Package,
  DollarSign, FileText, Clock, MessageCircle, Hotel, UserCheck, TrendingUp,
  MessageSquare
} from 'lucide-react'
import { format } from 'date-fns'
import Link from 'next/link'

// stock_inventory covers the unified daily stock+sales report managers submit
type ReportType = 'stock_inventory' | 'expense' | 'occupancy' | 'guest_activity' | 'revenue' | 'complaint'

interface ReportDetail {
  id: string
  manager_id: string
  manager_name: string
  manager_role: 'manager' | 'front_office_manager'
  report_date: string
  created_at: string
  status: 'pending' | 'approved' | 'rejected' | 'clarification_requested'
  notes?: string
  total_amount?: number
  rejection_reason?: string
  rejection_feedback?: string
  resubmission_deadline?: string
  reviewed_at?: string
  clarification_thread?: ClarificationMessage[]
  extra_fields?: Record<string, any>
}

const formatCurrency = (amount: number | null | undefined) => {
  if (amount == null) return '₦0.00'
  return `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// Maps URL param type → actual Supabase table
const TABLE_MAP: Record<ReportType, string> = {
  stock_inventory: 'stock_inventory_reports',
  expense:         'expense_reports',
  occupancy:       'occupancy_reports',
  guest_activity:  'guest_activity_reports',
  revenue:         'revenue_reports',
  complaint:       'complaint_reports',
}

// Foreign key aliases for manager join
const FKEY_MAP: Record<ReportType, string> = {
  stock_inventory: 'users!stock_inventory_reports_manager_id_fkey(full_name, role)',
  expense:         'users!expense_reports_manager_id_fkey(full_name, role)',
  occupancy:       'users!occupancy_reports_manager_id_fkey(full_name, role)',
  guest_activity:  'users!guest_activity_reports_manager_id_fkey(full_name, role)',
  revenue:         'users!revenue_reports_manager_id_fkey(full_name, role)',
  complaint:       'users!complaint_reports_manager_id_fkey(full_name, role)',
}

export default function ReviewReportPage() {
  const router = useRouter()
  const params = useParams()
  const type = params.type as ReportType
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [report, setReport] = useState<ReportDetail | null>(null)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [showClarificationModal, setShowClarificationModal] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [rejectionFeedback, setRejectionFeedback] = useState('')
  const [resubmissionDeadline, setResubmissionDeadline] = useState('')
  const [clarificationRequest, setClarificationRequest] = useState('')
  const [processing, setProcessing] = useState(false)
  const [stockItems, setStockItems] = useState<any[]>([])

  useEffect(() => { loadReportDetail() }, [type, id])

  const loadReportDetail = async () => {
    try {
      const table = TABLE_MAP[type] as any
      const fkey = FKEY_MAP[type]
      const { data: reportData, error } = await supabase
        .from(table)
        .select(`*, ${fkey}`)
        .eq('id', id)
        .single()

      if (error) throw error

      // Load line items for the unified stock+sales report
      if (type === 'stock_inventory') {
        const { data: itemsData } = await supabase
          .from('stock_inventory_items')
          .select('*')
          .eq('report_id', id)
          .order('item_section')
        setStockItems(itemsData || [])
      }

      const extra: Record<string, any> = {}
      if (type === 'occupancy') {
        extra.total_rooms = reportData.total_rooms
        extra.occupied_rooms = reportData.occupied_rooms
        extra.vacant_rooms = reportData.vacant_rooms
        extra.maintenance_rooms = reportData.maintenance_rooms
        extra.occupancy_percentage = reportData.occupancy_percentage
      } else if (type === 'guest_activity') {
        extra.check_ins = reportData.check_ins
        extra.check_outs = reportData.check_outs
        extra.expected_arrivals = reportData.expected_arrivals
        extra.expected_departures = reportData.expected_departures
        extra.walk_ins = reportData.walk_ins
        extra.no_shows = reportData.no_shows
      } else if (type === 'revenue') {
        extra.room_revenue = reportData.room_revenue
        extra.food_beverage_revenue = reportData.food_beverage_revenue
        extra.laundry_revenue = reportData.laundry_revenue
        extra.other_services_revenue = reportData.other_services_revenue
        extra.total_revenue = reportData.total_revenue
        extra.cash_payments = reportData.cash_payments
        extra.card_payments = reportData.card_payments
        extra.transfer_payments = reportData.transfer_payments
      } else if (type === 'complaint') {
        extra.complaint_type = reportData.complaint_type
        extra.guest_name = reportData.guest_name
        extra.room_number = reportData.room_number
        extra.description = reportData.description
        extra.severity = reportData.severity
        extra.resolution_status = reportData.resolution_status
        extra.resolution_details = reportData.resolution_details
      } else if (type === 'stock_inventory') {
        extra.cash_payments = reportData.cash_payments
        extra.card_payments = reportData.card_payments
        extra.transfer_payments = reportData.transfer_payments
      }

      setReport({
        id: reportData.id,
        manager_id: reportData.manager_id,
        manager_name: reportData.users?.full_name || 'Unknown',
        manager_role: (reportData.users?.role || 'manager') as 'manager' | 'front_office_manager',
        report_date: reportData.report_date,
        created_at: reportData.created_at,
        status: reportData.status,
        notes: reportData.notes,
        total_amount: reportData.total_amount || reportData.total_revenue,
        rejection_reason: reportData.rejection_reason,
        rejection_feedback: reportData.rejection_feedback,
        resubmission_deadline: reportData.resubmission_deadline,
        reviewed_at: reportData.reviewed_at,
        clarification_thread: reportData.clarification_thread || [],
        extra_fields: extra,
      })
    } catch (error) {
      console.error('Error loading report:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async () => {
    if (!report) return
    setProcessing(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const table = TABLE_MAP[type] as any
      const { error } = await supabase.from(table).update({
        status: 'approved',
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
      }).eq('id', id)
      if (error) throw error
      alert('Report approved successfully!')
      router.push('/bdm/pending')
    } catch (error) {
      alert('Failed to approve report')
    } finally {
      setProcessing(false)
    }
  }

  const handleReject = async () => {
    if (!report || !rejectionReason || !rejectionFeedback) {
      alert('Please provide rejection reason and feedback')
      return
    }
    setProcessing(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const table = TABLE_MAP[type] as any
      const { error } = await supabase.from(table).update({
        status: 'rejected',
        rejection_reason: rejectionReason,
        rejection_feedback: rejectionFeedback,
        resubmission_deadline: resubmissionDeadline || null,
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
      }).eq('id', id)
      if (error) throw error
      alert('Report rejected. Manager will be notified.')
      router.push('/bdm/pending')
    } catch (error) {
      alert('Failed to reject report')
    } finally {
      setProcessing(false)
      setShowRejectModal(false)
    }
  }

  const handleRequestClarification = async () => {
    if (!report || !clarificationRequest.trim()) return
    setProcessing(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No user')
      const { data: userData } = await supabase.from('users').select('full_name').eq('id', user.id).single()
      const newMessage: ClarificationMessage = {
        id: crypto.randomUUID(),
        type: 'question',
        author_id: user.id,
        author_name: userData?.full_name || 'BDM',
        author_role: 'bdm',
        content: clarificationRequest,
        timestamp: new Date().toISOString(),
      }
      const updatedThread = [...(report.clarification_thread || []), newMessage]
      const table = TABLE_MAP[type] as any
      const { error } = await supabase.from(table).update({
        status: 'clarification_requested',
        clarification_thread: updatedThread,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      }).eq('id', id)
      if (error) throw error
      alert('Clarification request sent!')
      router.push('/bdm/pending')
    } catch (error) {
      alert('Failed to send clarification request')
    } finally {
      setProcessing(false)
      setShowClarificationModal(false)
    }
  }

  const getBackLink = () => {
    if (!report) return { href: '/bdm/pending', label: 'Back to Pending Reports' }
    switch (report.status) {
      case 'approved': return { href: '/bdm/approved', label: 'Back to Approved Reports' }
      case 'rejected': return { href: '/bdm/rejected', label: 'Back to Rejected Reports' }
      default: return { href: '/bdm/pending', label: 'Back to Pending Reports' }
    }
  }

  const getReportIcon = () => {
    switch (type) {
      case 'stock_inventory': return <Package className="w-6 h-6 text-blue-500" />
      case 'expense':         return <FileText className="w-6 h-6 text-purple-500" />
      case 'occupancy':       return <Hotel className="w-6 h-6 text-indigo-500" />
      case 'guest_activity':  return <UserCheck className="w-6 h-6 text-pink-500" />
      case 'revenue':         return <TrendingUp className="w-6 h-6 text-emerald-500" />
      case 'complaint':       return <MessageSquare className="w-6 h-6 text-red-500" />
    }
  }

  const getReportTitle = () => {
    switch (type) {
      case 'stock_inventory': return 'Stock & Sales Report'
      case 'expense':         return 'Expense Report'
      case 'occupancy':       return 'Occupancy Report'
      case 'guest_activity':  return 'Guest Activity Report'
      case 'revenue':         return 'Revenue Report'
      case 'complaint':       return 'Complaint Report'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':                return 'Pending Review'
      case 'approved':               return 'Approved'
      case 'rejected':               return 'Rejected'
      case 'clarification_requested': return 'Clarification Requested'
      default: return status
    }
  }

  const hasUnreadResponse = () => {
    if (!report?.clarification_thread?.length) return false
    return report.clarification_thread[report.clarification_thread.length - 1].type === 'response'
  }

  const showActionButtons =
    report?.status === 'pending' ||
    (report?.status === 'clarification_requested' && hasUnreadResponse())

  const backLink = getBackLink()
  const ef = report?.extra_fields || {}

  // Parse optional payment breakdown from notes field
  const parsePaymentBreakdown = (notes?: string) => {
    if (!notes) return null
    const marker = '__PAYMENT_BREAKDOWN__'
    const idx = notes.indexOf(marker)
    if (idx === -1) return null
    try {
      return JSON.parse(notes.slice(idx + marker.length).trim())
    } catch { return null }
  }

  const cleanNotes = (notes?: string) => {
    if (!notes) return ''
    const idx = notes.indexOf('__PAYMENT_BREAKDOWN__')
    return idx === -1 ? notes : notes.slice(0, idx).trim()
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800'
      case 'high':     return 'bg-orange-100 text-orange-800'
      case 'medium':   return 'bg-yellow-100 text-yellow-800'
      default:         return 'bg-green-100 text-green-800'
    }
  }

  if (loading) return <div className="p-8"><div className="text-lg text-gray-600">Loading report details...</div></div>
  if (!report)  return <div className="p-8"><div className="text-lg text-red-600">Report not found</div></div>

  const paymentBreakdown = type === 'stock_inventory' ? parsePaymentBreakdown(report.notes) : null
  const visibleNotes = type === 'stock_inventory' ? cleanNotes(report.notes) : report.notes

  const previousStockItems = stockItems.filter(i => i.item_section === 'previous_stock')
  const newStockItems      = stockItems.filter(i => i.item_section === 'new_stock')
  const salesItems         = stockItems.filter(i => i.item_section === 'sales')

  // Build unified stock rows from previous + new arrays (keyed by item_name)
  const stockRows = previousStockItems.map(prev => {
    const newItem = newStockItems.find(n => n.item_name === prev.item_name)
    return {
      item_name: prev.item_name,
      previous_qty: prev.quantity ?? 0,
      new_qty: newItem?.quantity ?? 0,
      total: (prev.quantity ?? 0) + (newItem?.quantity ?? 0),
    }
  })
  // Also include any new stock items that have no matching previous entry
  newStockItems.forEach(n => {
    if (!stockRows.find(r => r.item_name === n.item_name)) {
      stockRows.push({ item_name: n.item_name, previous_qty: 0, new_qty: n.quantity ?? 0, total: n.quantity ?? 0 })
    }
  })

  const totalSalesRevenue = salesItems.reduce((s, i) => s + (i.total_amount ?? 0), 0)
  const totalPayments = (ef.cash_payments ?? 0) + (ef.card_payments ?? 0) + (ef.transfer_payments ?? 0)

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link href={backLink.href} className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          {backLink.label}
        </Link>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center space-x-4">
            {getReportIcon()}
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{getReportTitle()}</h1>
              <div className="flex items-center space-x-2 mt-1">
                <p className="text-gray-600">Review and take action</p>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                  report.manager_role === 'front_office_manager'
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'bg-gray-100 text-gray-700'
                }`}>
                  {report.manager_role === 'front_office_manager' ? '🏨 Front Office Manager' : '🏪 Store Manager'}
                </span>
              </div>
            </div>
          </div>
          <span className={`status-badge status-${report.status}`}>
            {getStatusLabel(report.status)}
          </span>
        </div>
      </div>

      {/* Rejection details */}
      {report.status === 'rejected' && report.rejection_reason && (
        <div className="mb-6 card border-l-4 border-red-500 bg-red-50">
          <h3 className="text-lg font-semibold text-red-900 mb-3 flex items-center">
            <XCircle className="w-5 h-5 mr-2" /> Rejection Details
          </h3>
          <div className="space-y-3">
            <div><span className="text-sm font-semibold text-red-700">Reason:</span><p className="text-sm text-red-800 mt-1">{report.rejection_reason}</p></div>
            <div><span className="text-sm font-semibold text-red-700">Feedback:</span><p className="text-sm text-red-800 mt-1">{report.rejection_feedback}</p></div>
            {report.resubmission_deadline && (
              <div><span className="text-sm font-semibold text-red-700">Resubmission Deadline:</span>
                <p className="text-sm text-red-800 mt-1">{format(new Date(report.resubmission_deadline), 'MMM dd, yyyy')}</p>
              </div>
            )}
            {report.reviewed_at && (
              <div><span className="text-sm font-semibold text-red-700">Rejected On:</span>
                <p className="text-sm text-red-800 mt-1">{format(new Date(report.reviewed_at), 'MMM dd, yyyy h:mm a')}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Approval banner */}
      {report.status === 'approved' && report.reviewed_at && (
        <div className="mb-6 card border-l-4 border-green-500 bg-green-50">
          <h3 className="text-lg font-semibold text-green-900 mb-2 flex items-center">
            <CheckCircle className="w-5 h-5 mr-2" /> Approved
          </h3>
          <p className="text-sm text-green-800">This report was approved on {format(new Date(report.reviewed_at), 'MMM dd, yyyy h:mm a')}</p>
        </div>
      )}

      {/* Clarification thread */}
      {report.clarification_thread && report.clarification_thread.length > 0 && (
        <div className="mb-6 card bg-orange-50 border-orange-200">
          <div className="flex items-start space-x-3">
            <MessageCircle className="w-6 h-6 text-orange-600 mt-1 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-orange-900 mb-3">
                Clarification Conversation
                <span className="ml-2 text-sm font-normal text-orange-600">
                  ({report.clarification_thread.length} message{report.clarification_thread.length > 1 ? 's' : ''})
                </span>
              </h3>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {report.clarification_thread.map((message, index) => (
                  <div key={message.id} className={`rounded-lg p-4 ${
                    message.type === 'question' ? 'bg-blue-50 border border-blue-200' : 'bg-green-50 border border-green-200'
                  }`}>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        {message.type === 'question'
                          ? <AlertCircle className="w-4 h-4 text-blue-600" />
                          : <CheckCircle className="w-4 h-4 text-green-600" />}
                        <span className={`text-sm font-semibold ${message.type === 'question' ? 'text-blue-900' : 'text-green-900'}`}>
                          {message.type === 'question' ? 'BDM Question' : "Manager's Response"}
                          {message.author_name && ` — ${message.author_name}`}
                        </span>
                      </div>
                      <span className={`text-xs ${message.type === 'question' ? 'text-blue-600' : 'text-green-600'}`}>
                        {format(new Date(message.timestamp), 'MMM dd, h:mm a')}
                      </span>
                    </div>
                    <div className={`text-sm whitespace-pre-wrap ${message.type === 'question' ? 'text-blue-800' : 'text-green-800'}`}>
                      {message.content}
                    </div>
                    {index === report.clarification_thread!.length - 1 && message.type === 'response' && report.status === 'clarification_requested' && (
                      <div className="mt-3 pt-3 border-t border-green-300">
                        <div className="text-xs font-semibold text-green-900 mb-1">Manager responded — what would you like to do?</div>
                        <div className="text-xs text-green-700 space-y-0.5">
                          <div>✅ <strong>Approve</strong> — if the response is satisfactory</div>
                          <div>❓ <strong>Ask Another Question</strong> — if you need more info</div>
                          <div>❌ <strong>Reject</strong> — if fundamental issues remain</div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {report.clarification_thread[report.clarification_thread.length - 1].type === 'question' && report.status === 'clarification_requested' && (
                <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <div className="flex items-center space-x-2 text-sm text-yellow-800">
                    <Clock className="w-4 h-4" />
                    <span>Waiting for manager's response...</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Report meta */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="card">
          <div className="flex items-center space-x-3">
            <User className="w-5 h-5 text-gray-400" />
            <div>
              <div className="text-sm text-gray-600">Submitted By</div>
              <div className="font-semibold text-gray-900">{report.manager_name}</div>
              <div className="text-xs text-gray-500">{report.manager_role === 'front_office_manager' ? 'Front Office Manager' : 'Store Manager'}</div>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center space-x-3">
            <Calendar className="w-5 h-5 text-gray-400" />
            <div>
              <div className="text-sm text-gray-600">Report Date</div>
              <div className="font-semibold text-gray-900">{format(new Date(report.report_date), 'MMM dd, yyyy')}</div>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center space-x-3">
            <Clock className="w-5 h-5 text-gray-400" />
            <div>
              <div className="text-sm text-gray-600">Submitted On</div>
              <div className="font-semibold text-gray-900">{format(new Date(report.created_at), 'MMM dd, yyyy h:mm a')}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── STOCK & SALES REPORT DETAILS ── */}
      {type === 'stock_inventory' && (
        <div className="space-y-6 mb-6">

          {/* Stock levels table */}
          {stockRows.length > 0 && (
            <div className="card bg-purple-50 border-purple-200">
              <h2 className="text-lg font-bold text-purple-900 mb-4">📦 Stock Levels</h2>
              <div className="bg-white rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-purple-100">
                    <tr>
                      <th className="px-4 py-3 text-left text-purple-900 font-semibold">Item</th>
                      <th className="px-4 py-3 text-right text-purple-900 font-semibold">Previous Day's Stock<br/><span className="font-normal text-xs text-purple-600">(Closing Stock)</span></th>
                      <th className="px-4 py-3 text-right text-purple-900 font-semibold">New Stock<br/><span className="font-normal text-xs text-purple-600">(Requisition Received)</span></th>
                      <th className="px-4 py-3 text-right text-purple-900 font-semibold">Total Available</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockRows.map((row, i) => (
                      <tr key={i} className="border-t border-purple-100">
                        <td className="px-4 py-3 font-medium text-gray-900">{row.item_name}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{row.previous_qty}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{row.new_qty}</td>
                        <td className="px-4 py-3 text-right font-bold text-purple-900">{row.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Sales table */}
          {salesItems.length > 0 && (
            <div className="card bg-orange-50 border-orange-200">
              <h2 className="text-lg font-bold text-orange-900 mb-4">🛒 Sales</h2>
              <div className="bg-white rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-orange-100">
                    <tr>
                      <th className="px-4 py-3 text-left text-orange-900 font-semibold">Item</th>
                      <th className="px-4 py-3 text-right text-orange-900 font-semibold">Qty Sold</th>
                      <th className="px-4 py-3 text-right text-orange-900 font-semibold">Unit Price</th>
                      <th className="px-4 py-3 text-right text-orange-900 font-semibold">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salesItems.map((item, i) => (
                      <tr key={i} className="border-t border-orange-100">
                        <td className="px-4 py-3 font-medium text-gray-900">{item.item_name}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{item.quantity}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(item.unit_price)}</td>
                        <td className="px-4 py-3 text-right font-bold text-orange-900">{formatCurrency(item.total_amount)}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-orange-300 bg-orange-50">
                      <td colSpan={3} className="px-4 py-3 font-bold text-orange-900 text-right">Total Sales Revenue</td>
                      <td className="px-4 py-3 text-right font-bold text-orange-900 text-lg">{formatCurrency(totalSalesRevenue)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Payment breakdown */}
          <div className="card">
            <h2 className="text-lg font-bold text-gray-900 mb-4">💰 Payment Methods</h2>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="bg-gray-50 p-3 rounded-lg text-center">
                <div className="text-xs text-gray-500 mb-1">Cash</div>
                <div className="font-bold text-gray-900">{formatCurrency(ef.cash_payments)}</div>
              </div>
              <div className="bg-blue-50 p-3 rounded-lg text-center">
                <div className="text-xs text-gray-500 mb-1">Card / POS</div>
                <div className="font-bold text-gray-900">{formatCurrency(ef.card_payments)}</div>
              </div>
              <div className="bg-purple-50 p-3 rounded-lg text-center">
                <div className="text-xs text-gray-500 mb-1">Transfer</div>
                <div className="font-bold text-gray-900">{formatCurrency(ef.transfer_payments)}</div>
              </div>
            </div>

            {/* Per-bank breakdown if available */}
            {paymentBreakdown && (
              <div className="space-y-3">
                {paymentBreakdown.card_breakdown?.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-gray-600 mb-1">Card/POS by terminal:</div>
                    {paymentBreakdown.card_breakdown.map((b: any, i: number) => (
                      <div key={i} className="flex justify-between text-sm text-blue-700 pl-3">
                        <span>↳ {b.bank}</span>
                        <span>{formatCurrency(b.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
                {paymentBreakdown.transfer_breakdown?.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-gray-600 mb-1">Transfers by bank:</div>
                    {paymentBreakdown.transfer_breakdown.map((b: any, i: number) => (
                      <div key={i} className="flex justify-between text-sm text-purple-700 pl-3">
                        <span>↳ {b.bank}</span>
                        <span>{formatCurrency(b.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="mt-4 pt-4 border-t flex justify-between items-center">
              <span className="font-bold text-gray-900">Total Payments</span>
              <span className="text-xl font-bold text-gray-900">{formatCurrency(totalPayments)}</span>
            </div>
            {Math.abs(totalPayments - totalSalesRevenue) > 0.01 && totalPayments > 0 && totalSalesRevenue > 0 && (
              <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-700 font-medium">
                ⚠️ Payments ({formatCurrency(totalPayments)}) don't match sales revenue ({formatCurrency(totalSalesRevenue)})
              </div>
            )}
          </div>

          {visibleNotes && (
            <div className="card">
              <div className="text-sm font-medium text-gray-700 mb-2">Additional Notes</div>
              <div className="p-3 bg-gray-50 rounded text-sm text-gray-700">{visibleNotes}</div>
            </div>
          )}
        </div>
      )}

      {/* ── EXPENSE REPORT ── */}
      {type === 'expense' && (
        <div className="card mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Report Details</h2>
          {report.notes && (
            <div className="p-3 bg-gray-50 rounded text-sm text-gray-700">{report.notes}</div>
          )}
        </div>
      )}

      {/* ── OCCUPANCY REPORT ── */}
      {type === 'occupancy' && (
        <div className="card mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Report Details</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { label: 'Total Rooms',     value: ef.total_rooms,          color: 'bg-gray-50' },
              { label: 'Occupied',        value: ef.occupied_rooms,        color: 'bg-green-50' },
              { label: 'Vacant',          value: ef.vacant_rooms,          color: 'bg-blue-50' },
              { label: 'Maintenance',     value: ef.maintenance_rooms,     color: 'bg-yellow-50' },
              { label: 'Occupancy Rate',  value: `${ef.occupancy_percentage}%`, color: 'bg-indigo-50' },
            ].map(({ label, value, color }) => (
              <div key={label} className={`${color} p-4 rounded-lg`}>
                <div className="text-sm text-gray-600">{label}</div>
                <div className="text-2xl font-bold text-gray-900 mt-1">{value}</div>
              </div>
            ))}
            {report.notes && <div className="col-span-full mt-2"><div className="text-sm font-medium text-gray-700 mb-1">Notes:</div><div className="p-3 bg-gray-50 rounded text-sm text-gray-700">{report.notes}</div></div>}
          </div>
        </div>
      )}

      {/* ── GUEST ACTIVITY REPORT ── */}
      {type === 'guest_activity' && (
        <div className="card mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Report Details</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { label: 'Check-Ins',           value: ef.check_ins,           color: 'bg-green-50' },
              { label: 'Check-Outs',          value: ef.check_outs,          color: 'bg-blue-50' },
              { label: 'Expected Arrivals',   value: ef.expected_arrivals,   color: 'bg-indigo-50' },
              { label: 'Expected Departures', value: ef.expected_departures, color: 'bg-purple-50' },
              { label: 'Walk-Ins',            value: ef.walk_ins,            color: 'bg-pink-50' },
              { label: 'No-Shows',            value: ef.no_shows,            color: 'bg-red-50' },
            ].map(({ label, value, color }) => (
              <div key={label} className={`${color} p-4 rounded-lg`}>
                <div className="text-sm text-gray-600">{label}</div>
                <div className="text-2xl font-bold text-gray-900 mt-1">{value}</div>
              </div>
            ))}
            {report.notes && <div className="col-span-full mt-2"><div className="text-sm font-medium text-gray-700 mb-1">Notes:</div><div className="p-3 bg-gray-50 rounded text-sm text-gray-700">{report.notes}</div></div>}
          </div>
        </div>
      )}

      {/* ── REVENUE REPORT ── */}
      {type === 'revenue' && (
        <div className="card mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Report Details</h2>
          <div className="space-y-4">
            <div className="p-4 bg-emerald-50 rounded-lg">
              <div className="text-sm text-gray-600">Total Revenue</div>
              <div className="text-3xl font-bold text-emerald-700 mt-1">{formatCurrency(ef.total_revenue)}</div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Room Revenue', value: ef.room_revenue },
                { label: 'Food & Beverage', value: ef.food_beverage_revenue },
                { label: 'Laundry', value: ef.laundry_revenue },
                { label: 'Other Services', value: ef.other_services_revenue },
              ].map(({ label, value }) => (
                <div key={label} className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-xs text-gray-500">{label}</div>
                  <div className="font-semibold text-gray-900 mt-1">{formatCurrency(value)}</div>
                </div>
              ))}
            </div>
            <div>
              <div className="text-sm font-medium text-gray-700 mb-2">Payment Methods</div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Cash', value: ef.cash_payments },
                  { label: 'Card', value: ef.card_payments },
                  { label: 'Transfer', value: ef.transfer_payments },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-gray-50 p-3 rounded-lg text-center">
                    <div className="text-xs text-gray-500">{label}</div>
                    <div className="font-semibold text-gray-900 mt-1 text-sm">{formatCurrency(value)}</div>
                  </div>
                ))}
              </div>
            </div>
            {report.notes && <div><div className="text-sm font-medium text-gray-700 mb-1">Notes:</div><div className="p-3 bg-gray-50 rounded text-sm text-gray-700">{report.notes}</div></div>}
          </div>
        </div>
      )}

      {/* ── COMPLAINT REPORT ── */}
      {type === 'complaint' && (
        <div className="card mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Report Details</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-xs text-gray-500">Complaint Type</div>
                <div className="font-semibold text-gray-900 mt-1 capitalize">{ef.complaint_type?.replace('_', ' ')}</div>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-xs text-gray-500">Severity</div>
                <span className={`inline-block mt-1 px-2 py-0.5 rounded text-sm font-medium capitalize ${getSeverityColor(ef.severity)}`}>{ef.severity}</span>
              </div>
              {ef.guest_name && <div className="bg-gray-50 p-3 rounded-lg"><div className="text-xs text-gray-500">Guest Name</div><div className="font-semibold text-gray-900 mt-1">{ef.guest_name}</div></div>}
              {ef.room_number && <div className="bg-gray-50 p-3 rounded-lg"><div className="text-xs text-gray-500">Room Number</div><div className="font-semibold text-gray-900 mt-1">{ef.room_number}</div></div>}
            </div>
            <div><div className="text-sm font-medium text-gray-700 mb-1">Description</div><div className="p-3 bg-gray-50 rounded text-sm text-gray-700">{ef.description}</div></div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-xs text-gray-500">Resolution Status</div>
              <div className="font-semibold text-gray-900 mt-1 capitalize">{ef.resolution_status?.replace('_', ' ')}</div>
              {ef.resolution_details && <div className="text-sm text-gray-600 mt-1">{ef.resolution_details}</div>}
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {showActionButtons && (
        <div className="flex flex-wrap gap-4">
          <button onClick={handleApprove} disabled={processing} className="btn-primary flex items-center">
            <CheckCircle className="w-5 h-5 mr-2" /> Approve Report
          </button>
          <button
            onClick={() => { setClarificationRequest(''); setShowClarificationModal(true) }}
            disabled={processing}
            className="px-6 py-2 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 transition-colors flex items-center disabled:opacity-50"
          >
            <MessageCircle className="w-5 h-5 mr-2" />
            {report.clarification_thread && report.clarification_thread.length > 0 ? 'Ask Another Question' : 'Request Clarification'}
          </button>
          <button onClick={() => setShowRejectModal(true)} disabled={processing} className="btn-danger flex items-center">
            <XCircle className="w-5 h-5 mr-2" /> Reject Report
          </button>
        </div>
      )}

      {/* Waiting message */}
      {report.status === 'clarification_requested' && !hasUnreadResponse() && (
        <div className="card bg-yellow-50 border-yellow-200">
          <div className="flex items-center space-x-3">
            <Clock className="w-6 h-6 text-yellow-600" />
            <div>
              <div className="font-semibold text-yellow-900">Waiting for Manager's Response</div>
              <div className="text-sm text-yellow-700 mt-1">The manager has been notified and will respond shortly.</div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Reject Report</h2>
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
              <strong>Note:</strong> Rejecting requires the manager to resubmit. Consider requesting clarification instead if you just need more info.
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Rejection Reason *</label>
                <input type="text" value={rejectionReason} onChange={e => setRejectionReason(e.target.value)}
                  placeholder="e.g., Incomplete data, Incorrect figures"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Detailed Feedback *</label>
                <textarea value={rejectionFeedback} onChange={e => setRejectionFeedback(e.target.value)}
                  placeholder="Provide detailed feedback on what needs to be corrected..." rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Resubmission Deadline (Optional)</label>
                <input type="date" value={resubmissionDeadline} onChange={e => setResubmissionDeadline(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500" />
              </div>
            </div>
            <div className="flex space-x-4 mt-6">
              <button onClick={handleReject} disabled={processing || !rejectionReason || !rejectionFeedback} className="btn-danger flex-1">Confirm Rejection</button>
              <button onClick={() => setShowRejectModal(false)} disabled={processing} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Clarification Modal */}
      {showClarificationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-2xl w-full mx-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              {report.clarification_thread && report.clarification_thread.length > 0 ? 'Ask Another Question' : 'Request Clarification'}
            </h2>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Your Question *</label>
              <textarea value={clarificationRequest} onChange={e => setClarificationRequest(e.target.value)}
                placeholder="Ask the manager to clarify specific details..." rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500" />
              <p className="mt-2 text-sm text-gray-500">The manager can respond without resubmitting the report.</p>
            </div>
            <div className="flex space-x-4">
              <button onClick={handleRequestClarification} disabled={processing || !clarificationRequest.trim()}
                className="px-6 py-2 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 transition-colors flex-1 disabled:opacity-50">
                Send Request
              </button>
              <button onClick={() => setShowClarificationModal(false)} disabled={processing} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}