'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase, ClarificationMessage } from '@/lib/supabase'
import { ArrowLeft, CheckCircle, XCircle, Calendar, User, Package, DollarSign, FileText, AlertTriangle, AlertCircle, Send, Clock, MessageCircle, Hotel, UserCheck, TrendingUp, MessageSquare } from 'lucide-react'
import { format } from 'date-fns'
import Link from 'next/link'

interface ReportDetail {
  id: string
  manager_id: string
  report_date: string
  created_at: string
  status: 'pending' | 'approved' | 'rejected' | 'clarification_requested'
  notes?: string
  total_amount?: number
  reviewed_at?: string
  reviewed_by_name?: string
  rejection_reason?: string
  rejection_feedback?: string
  resubmission_deadline?: string
  clarification_thread?: ClarificationMessage[]
  items?: any[]
}

export default function ManagerViewReportPage() {
  const router = useRouter()
  const params = useParams()
  const type = params.type as 'stock' | 'sales' | 'expense' | 'occupancy' | 'guest_activity' | 'revenue' | 'complaint'
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [report, setReport] = useState<ReportDetail | null>(null)
  const [clarificationResponse, setClarificationResponse] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadReportDetail()
  }, [type, id])

  const loadReportDetail = async () => {
    try {
      let query: any
      let itemsQuery: any = null

      switch (type) {
        case 'stock':
          query = supabase
            .from('stock_reports')
            .select('*, reviewer:users!stock_reports_reviewed_by_fkey(full_name)')
            .eq('id', id)
            .single()
          itemsQuery = supabase
            .from('stock_report_items')
            .select('*')
            .eq('report_id', id)
          break
        case 'sales':
          query = supabase
            .from('sales_reports')
            .select('*, reviewer:users!sales_reports_reviewed_by_fkey(full_name)')
            .eq('id', id)
            .single()
          itemsQuery = supabase
            .from('sales_report_items')
            .select('*')
            .eq('report_id', id)
          break
        case 'expense':
          query = supabase
            .from('expense_reports')
            .select('*, reviewer:users!expense_reports_reviewed_by_fkey(full_name)')
            .eq('id', id)
            .single()
          itemsQuery = supabase
            .from('expense_report_items')
            .select('*')
            .eq('report_id', id)
          break
        case 'occupancy':
          query = supabase
            .from('occupancy_reports')
            .select('*, reviewer:users!occupancy_reports_reviewed_by_fkey(full_name)')
            .eq('id', id)
            .single()
          break
        case 'guest_activity':
          query = supabase
            .from('guest_activity_reports')
            .select('*, reviewer:users!guest_activity_reports_reviewed_by_fkey(full_name)')
            .eq('id', id)
            .single()
          break
        case 'revenue':
          query = supabase
            .from('revenue_reports')
            .select('*, reviewer:users!revenue_reports_reviewed_by_fkey(full_name)')
            .eq('id', id)
            .single()
          break
        case 'complaint':
          query = supabase
            .from('complaint_reports')
            .select('*, reviewer:users!complaint_reports_reviewed_by_fkey(full_name)')
            .eq('id', id)
            .single()
          break
      }

      const queries = itemsQuery ? [query, itemsQuery] : [query]
      const results = await Promise.all(queries)
      const reportData = results[0]
      const itemsData = results[1] || { data: [] }

      if (reportData.data) {
        setReport({
          id: reportData.data.id,
          manager_id: reportData.data.manager_id,
          report_date: reportData.data.report_date,
          created_at: reportData.data.created_at,
          status: reportData.data.status,
          notes: reportData.data.notes,
          total_amount: reportData.data.total_amount || reportData.data.total_revenue,
          reviewed_at: reportData.data.reviewed_at,
          reviewed_by_name: reportData.data.reviewer?.full_name || 'BDM',
          rejection_reason: reportData.data.rejection_reason,
          rejection_feedback: reportData.data.rejection_feedback,
          resubmission_deadline: reportData.data.resubmission_deadline,
          clarification_thread: reportData.data.clarification_thread || [],
          items: itemsData.data || [],
        })
      }
    } catch (error) {
      console.error('Error loading report:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitClarification = async () => {
    if (!clarificationResponse.trim()) {
      alert('Please enter your response before submitting')
      return
    }

    setSubmitting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No user found')

      // Get user's full name
      const { data: userData } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', user.id)
        .single()

      // Create new response message
      const newMessage: ClarificationMessage = {
        id: crypto.randomUUID(),
        type: 'response',
        author_id: user.id,
        author_name: userData?.full_name || 'Manager',
        author_role: 'manager',
        content: clarificationResponse,
        timestamp: new Date().toISOString(),
      }

      // Append to existing thread
      const updatedThread = [...(report?.clarification_thread || []), newMessage]

      const tableName = `${type}_reports`
      const { error } = await supabase
        .from(tableName as any)
        .update({
          clarification_thread: updatedThread,
        })
        .eq('id', id)

      if (error) throw error

      alert('Response submitted successfully! BDM will review your clarification.')
      setClarificationResponse('')
      loadReportDetail() // Reload to show updated thread
    } catch (error) {
      console.error('Error submitting response:', error)
      alert('Failed to submit response. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const getReportIcon = () => {
    switch (type) {
      case 'stock':
        return <Package className="w-6 h-6 text-blue-500" />
      case 'sales':
        return <DollarSign className="w-6 h-6 text-green-500" />
      case 'expense':
        return <FileText className="w-6 h-6 text-purple-500" />
      case 'occupancy':
        return <Hotel className="w-6 h-6 text-indigo-500" />
      case 'guest_activity':
        return <UserCheck className="w-6 h-6 text-pink-500" />
      case 'revenue':
        return <TrendingUp className="w-6 h-6 text-emerald-500" />
      case 'complaint':
        return <MessageSquare className="w-6 h-6 text-red-500" />
    }
  }

  const getReportTitle = () => {
    switch (type) {
      case 'stock':
        return 'Stock Report'
      case 'sales':
        return 'Sales Report'
      case 'expense':
        return 'Expense Report'
      case 'occupancy':
        return 'Occupancy Report'
      case 'guest_activity':
        return 'Guest Activity Report'
      case 'revenue':
        return 'Revenue Report'
      case 'complaint':
        return 'Complaint Report'
    }
  }

  const getBackLink = () => {
    if (report?.status === 'approved') return '/manager/reports/approved'
    if (report?.status === 'rejected') return '/manager/reports/rejected'
    if (report?.status === 'pending' || report?.status === 'clarification_requested') {
      return '/manager/reports/pending'
    }
    return '/manager/dashboard'
  }

  // Check if the last message is a question (needs response)
  const needsResponse = () => {
    if (!report?.clarification_thread || report.clarification_thread.length === 0) return false
    const lastMessage = report.clarification_thread[report.clarification_thread.length - 1]
    return lastMessage.type === 'question' && report.status === 'clarification_requested'
  }

  // Has clarification history (show even if approved/rejected)
  const hasClarificationHistory = () => {
    return report?.clarification_thread && report.clarification_thread.length > 0
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-lg text-gray-600">Loading report details...</div>
      </div>
    )
  }

  if (!report) {
    return (
      <div className="p-8">
        <div className="text-lg text-red-600">Report not found</div>
      </div>
    )
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <Link href={getBackLink()} className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Link>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {getReportIcon()}
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{getReportTitle()}</h1>
              <p className="text-gray-600 mt-1">Report Details</p>
            </div>
          </div>
          <span className={`status-badge status-${report.status}`}>
            {report.status === 'clarification_requested' 
              ? 'Clarification Requested' 
              : report.status.charAt(0).toUpperCase() + report.status.slice(1)}
          </span>
        </div>
      </div>

      {/* Clarification Thread Section - SHOW FOR ALL STATUSES IF EXISTS */}
      {hasClarificationHistory() && (
        <div className={`mb-6 card ${
          report.status === 'clarification_requested' 
            ? 'bg-orange-50 border-orange-200' 
            : 'bg-gray-50 border-gray-200'
        }`}>
          <div className="flex items-start space-x-3">
            <MessageCircle className={`w-6 h-6 mt-1 ${
              report.status === 'clarification_requested' ? 'text-orange-600' : 'text-gray-600'
            }`} />
            <div className="flex-1">
              <h3 className={`text-lg font-semibold mb-3 ${
                report.status === 'clarification_requested' ? 'text-orange-900' : 'text-gray-900'
              }`}>
                {report.status === 'clarification_requested' 
                  ? 'Clarification Conversation' 
                  : 'Clarification History'}
              </h3>
              
              {/* Thread of messages */}
              <div className="space-y-3 max-h-96 overflow-y-auto mb-4">
                {report.clarification_thread!.map((message, index) => (
                  <div
                    key={message.id}
                    className={`rounded-lg p-4 ${
                      message.type === 'question'
                        ? 'bg-blue-50 border border-blue-200'
                        : 'bg-green-50 border border-green-200'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        {message.type === 'question' ? (
                          <AlertCircle className="w-4 h-4 text-blue-600" />
                        ) : (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        )}
                        <span className={`text-sm font-semibold ${
                          message.type === 'question' ? 'text-blue-900' : 'text-green-900'
                        }`}>
                          {message.type === 'question' ? 'BDM\'s Question' : 'Your Response'}
                          {message.author_name && ` (${message.author_name})`}
                        </span>
                      </div>
                      <span className={`text-xs ${
                        message.type === 'question' ? 'text-blue-600' : 'text-green-600'
                      }`}>
                        {format(new Date(message.timestamp), 'MMM dd, h:mm a')}
                      </span>
                    </div>
                    <div className={`text-sm whitespace-pre-wrap ${
                      message.type === 'question' ? 'text-blue-800' : 'text-green-800'
                    }`}>
                      {message.content}
                    </div>
                  </div>
                ))}
              </div>

              {/* Response Input (if last message is a question AND status is clarification_requested) */}
              {needsResponse() && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Your Response:
                  </label>
                  <textarea
                    value={clarificationResponse}
                    onChange={(e) => setClarificationResponse(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
                    rows={4}
                    placeholder="Provide your clarification here while viewing the report details below..."
                  />
                  <button
                    onClick={handleSubmitClarification}
                    disabled={submitting || !clarificationResponse.trim()}
                    className="mt-3 px-6 py-2 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 transition-colors flex items-center space-x-2 disabled:opacity-50"
                  >
                    {submitting ? (
                      <>
                        <Clock className="w-4 h-4 animate-spin" />
                        <span>Submitting...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Submit Response</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Already responded indicator OR Resolved status */}
              {report.status === 'clarification_requested' && 
               !needsResponse() && 
               report.clarification_thread![report.clarification_thread!.length - 1].type === 'response' && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="flex items-center space-x-2 text-sm text-green-800">
                    <CheckCircle className="w-4 h-4" />
                    <span>Response submitted. Waiting for BDM to review...</span>
                  </div>
                </div>
              )}

              {/* Show resolution status for approved/rejected */}
              {(report.status === 'approved' || report.status === 'rejected') && hasClarificationHistory() && (
                <div className={`${
                  report.status === 'approved' 
                    ? 'bg-green-50 border border-green-200' 
                    : 'bg-red-50 border border-red-200'
                } rounded-lg p-3`}>
                  <div className="flex items-center space-x-2 text-sm">
                    {report.status === 'approved' ? (
                      <>
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span className="text-green-800 font-medium">
                          Report was approved after clarification discussion
                        </span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4 text-red-600" />
                        <span className="text-red-800 font-medium">
                          Report was rejected after clarification discussion
                        </span>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Report Info Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
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
            <Calendar className="w-5 h-5 text-gray-400" />
            <div>
              <div className="text-sm text-gray-600">Submitted On</div>
              <div className="font-semibold text-gray-900">{format(new Date(report.created_at), 'MMM dd, yyyy h:mm a')}</div>
            </div>
          </div>
        </div>
        {report.reviewed_at && (
          <div className="card">
            <div className="flex items-center space-x-3">
              <User className="w-5 h-5 text-gray-400" />
              <div>
                <div className="text-sm text-gray-600">Reviewed By</div>
                <div className="font-semibold text-gray-900">{report.reviewed_by_name}</div>
                <div className="text-xs text-gray-500">{format(new Date(report.reviewed_at), 'MMM dd, yyyy')}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Rejection Details (if rejected) */}
      {report.status === 'rejected' && (
        <div className="mb-6 card bg-red-50 border-red-200">
          <div className="flex items-start space-x-3">
            <XCircle className="w-6 h-6 text-red-600 mt-1" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-red-900 mb-3">Report Rejected</h3>
              
              {report.resubmission_deadline && (
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center space-x-2 text-sm text-yellow-800">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="font-medium">
                      Resubmit by: {format(new Date(report.resubmission_deadline), 'MMM dd, yyyy')}
                    </span>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <div className="text-sm font-medium text-red-900 mb-1">Rejection Reason:</div>
                  <div className="text-sm text-red-800">{report.rejection_reason || 'No reason provided'}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-red-900 mb-1">Feedback:</div>
                  <div className="text-sm text-red-800">{report.rejection_feedback || 'No feedback provided'}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Report Details */}
      <div className="card mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Report Details</h2>
        
        {report.total_amount !== undefined && (
          <div className="mb-4 p-4 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-600">Total Amount</div>
            <div className="text-2xl font-bold text-gray-900">₦{report.total_amount.toFixed(2)}</div>
          </div>
        )}

        {report.notes && (
          <div className="mb-4">
            <div className="text-sm font-medium text-gray-700 mb-2">Notes:</div>
            <div className="p-4 bg-gray-50 rounded-lg text-gray-700">{report.notes}</div>
          </div>
        )}

        {/* Items Table (only for stock, sales, expense) */}
        {report.items && report.items.length > 0 && (
          <div>
            <div className="text-sm font-medium text-gray-700 mb-2">Items:</div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {type === 'stock' && (
                      <>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit</th>
                      </>
                    )}
                    {type === 'sales' && (
                      <>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit Price</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                      </>
                    )}
                    {type === 'expense' && (
                      <>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {report.items.map((item: any, index: number) => (
                    <tr key={index}>
                      {type === 'stock' && (
                        <>
                          <td className="px-6 py-4 text-sm text-gray-900">{item.item_name}</td>
                          <td className="px-6 py-4 text-sm text-gray-900">{item.quantity}</td>
                          <td className="px-6 py-4 text-sm text-gray-900">{item.unit}</td>
                        </>
                      )}
                      {type === 'sales' && (
                        <>
                          <td className="px-6 py-4 text-sm text-gray-900">{item.product_name}</td>
                          <td className="px-6 py-4 text-sm text-gray-900">{item.quantity}</td>
                          <td className="px-6 py-4 text-sm text-gray-900">₦{item.unit_price.toFixed(2)}</td>
                          <td className="px-6 py-4 text-sm font-semibold text-gray-900">₦{item.total_price.toFixed(2)}</td>
                        </>
                      )}
                      {type === 'expense' && (
                        <>
                          <td className="px-6 py-4 text-sm text-gray-900">{item.item_name}</td>
                          <td className="px-6 py-4 text-sm text-gray-900">{item.quantity}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}