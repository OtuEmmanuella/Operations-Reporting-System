'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase, ClarificationMessage } from '@/lib/supabase'
import { ArrowLeft, CheckCircle, XCircle, AlertCircle, Calendar, User, Package, DollarSign, FileText, Clock, MessageCircle } from 'lucide-react'
import { format } from 'date-fns'
import Link from 'next/link'

interface ReportDetail {
  id: string
  manager_id: string
  manager_name: string
  report_date: string
  created_at: string
  status: 'pending' | 'clarification_requested'
  notes?: string
  total_amount?: number
  clarification_thread?: ClarificationMessage[]
  items?: any[]
}

const formatCurrency = (amount: number | null | undefined): string => {
  if (amount === null || amount === undefined) {
    return '₦0.00'
  }
  return `₦${amount.toFixed(2)}`
}

export default function ReviewReportPage() {
  const router = useRouter()
  const params = useParams()
  const type = params.type as 'stock' | 'sales' | 'expense'
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

  useEffect(() => {
    loadReportDetail()
  }, [type, id])

  const loadReportDetail = async () => {
    try {
      let query: any
      let itemsQuery: any

      switch (type) {
        case 'stock':
          query = supabase
            .from('stock_reports')
            .select('*, users!stock_reports_manager_id_fkey(full_name)')
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
            .select('*, users!sales_reports_manager_id_fkey(full_name)')
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
            .select('*, users!expense_reports_manager_id_fkey(full_name)')
            .eq('id', id)
            .single()
          itemsQuery = supabase
            .from('expense_report_items')
            .select('*')
            .eq('report_id', id)
          break
      }

      const [reportData, itemsData] = await Promise.all([query, itemsQuery])

      if (reportData.data) {
        setReport({
          id: reportData.data.id,
          manager_id: reportData.data.manager_id,
          manager_name: reportData.data.users?.full_name || 'Unknown',
          report_date: reportData.data.report_date,
          created_at: reportData.data.created_at,
          status: reportData.data.status,
          notes: reportData.data.notes,
          total_amount: reportData.data.total_amount,
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

  const handleApprove = async () => {
    if (!report) return

    setProcessing(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      const tableName = `${type}_reports`
      const { error } = await supabase
        .from(tableName as 'stock_reports' | 'sales_reports' | 'expense_reports')
        .update({
          status: 'approved',
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', id)

      if (error) throw error

      alert('Report approved successfully!')
      router.push('/bdm/pending')
    } catch (error) {
      console.error('Error approving report:', error)
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
      
      const tableName = `${type}_reports`
      const { error } = await supabase
        .from(tableName as 'stock_reports' | 'sales_reports' | 'expense_reports')
        .update({
          status: 'rejected',
          rejection_reason: rejectionReason,
          rejection_feedback: rejectionFeedback,
          resubmission_deadline: resubmissionDeadline || null,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', id)

      if (error) throw error

      alert('Report rejected. Manager will be notified.')
      router.push('/bdm/pending')
    } catch (error) {
      console.error('Error rejecting report:', error)
      alert('Failed to reject report')
    } finally {
      setProcessing(false)
      setShowRejectModal(false)
    }
  }

  const handleRequestClarification = async () => {
    if (!report || !clarificationRequest.trim()) {
      alert('Please enter your clarification request')
      return
    }

    setProcessing(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No user found')

      // Get user's full name
      const { data: userData } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', user.id)
        .single()

      // Create new message in thread
      const newMessage: ClarificationMessage = {
        id: crypto.randomUUID(),
        type: 'question',
        author_id: user.id,
        author_name: userData?.full_name || 'BDM',
        author_role: 'bdm',
        content: clarificationRequest,
        timestamp: new Date().toISOString(),
      }

      // Append to existing thread
      const updatedThread = [...(report.clarification_thread || []), newMessage]

      const tableName = `${type}_reports`
      const { error } = await supabase
        .from(tableName as 'stock_reports' | 'sales_reports' | 'expense_reports')
        .update({
          status: 'clarification_requested',
          clarification_thread: updatedThread,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', id)

      if (error) throw error

      alert('Clarification request sent to manager!')
      router.push('/bdm/pending')
    } catch (error) {
      console.error('Error requesting clarification:', error)
      alert('Failed to send clarification request')
    } finally {
      setProcessing(false)
      setShowClarificationModal(false)
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
    }
  }

  // Check if the last message in the thread is a response (manager replied)
  const hasUnreadResponse = () => {
    if (!report?.clarification_thread || report.clarification_thread.length === 0) return false
    const lastMessage = report.clarification_thread[report.clarification_thread.length - 1]
    return lastMessage.type === 'response'
  }

  const showActionButtons = report?.status === 'pending' || 
    (report?.status === 'clarification_requested' && hasUnreadResponse())

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
        <Link href="/bdm/pending" className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Pending Reports
        </Link>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {getReportIcon()}
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{getReportTitle()}</h1>
              <p className="text-gray-600 mt-1">Review and take action on this report</p>
            </div>
          </div>
          <span className={`status-badge status-${report.status}`}>
            {report.status === 'clarification_requested' 
              ? 'Clarification Requested' 
              : 'Pending Review'}
          </span>
        </div>
      </div>

      {/* Clarification Thread Section */}
      {report.status === 'clarification_requested' && report.clarification_thread && report.clarification_thread.length > 0 && (
        <div className="mb-6 card bg-orange-50 border-orange-200">
          <div className="flex items-start space-x-3 mb-4">
            <MessageCircle className="w-6 h-6 text-orange-600 mt-1" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-orange-900 mb-3">Clarification Conversation</h3>
              
              {/* Thread of messages */}
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {report.clarification_thread.map((message, index) => (
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
                          {message.type === 'question' ? 'Your Question' : 'Manager\'s Response'}
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
                    
                    {/* Show indicator for last message */}
                    {index === report.clarification_thread!.length - 1 && message.type === 'response' && (
                      <div className="mt-3 pt-3 border-t border-green-300">
                        <div className="text-xs font-semibold text-green-900 mb-2">What would you like to do?</div>
                        <div className="text-xs text-green-700 space-y-1">
                          <div>✅ <strong>Approve</strong> - If the response is satisfactory</div>
                          <div>❓ <strong>Ask Another Question</strong> - If you need more clarification</div>
                          <div>❌ <strong>Reject</strong> - If fundamental issues require full resubmission</div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Waiting for response indicator */}
              {report.clarification_thread[report.clarification_thread.length - 1].type === 'question' && (
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

      {/* Report Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="card">
          <div className="flex items-center space-x-3">
            <User className="w-5 h-5 text-gray-400" />
            <div>
              <div className="text-sm text-gray-600">Submitted By</div>
              <div className="font-semibold text-gray-900">{report.manager_name}</div>
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
            <Calendar className="w-5 h-5 text-gray-400" />
            <div>
              <div className="text-sm text-gray-600">Submitted On</div>
              <div className="font-semibold text-gray-900">{format(new Date(report.created_at), 'MMM dd, yyyy h:mm a')}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Report Details */}
      <div className="card mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Report Details</h2>
        
        {report.total_amount !== undefined && (
          <div className="mb-4 p-4 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-600">Total Amount</div>
            <div className="text-2xl font-bold text-gray-900">{formatCurrency(report.total_amount)}</div>
          </div>
        )}

        {report.notes && (
          <div className="mb-4">
            <div className="text-sm font-medium text-gray-700 mb-2">Manager Notes:</div>
            <div className="p-4 bg-gray-50 rounded-lg text-gray-700">{report.notes}</div>
          </div>
        )}

        {/* Items Table */}
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
                          <td className="px-6 py-4 text-sm text-gray-900">{formatCurrency(item.unit_price)}</td>
                          <td className="px-6 py-4 text-sm font-semibold text-gray-900">{formatCurrency(item.total_price)}</td>
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

      {/* Action Buttons */}
      {showActionButtons && (
        <div className="flex flex-wrap gap-4">
          <button
            onClick={handleApprove}
            disabled={processing}
            className="btn-primary flex items-center"
          >
            <CheckCircle className="w-5 h-5 mr-2" />
            Approve Report
          </button>
          
          <button
            onClick={() => {
              setClarificationRequest('')
              setShowClarificationModal(true)
            }}
            disabled={processing}
            className="px-6 py-2 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 transition-colors flex items-center disabled:opacity-50"
          >
            <MessageCircle className="w-5 h-5 mr-2" />
            {report.clarification_thread && report.clarification_thread.length > 0
              ? 'Ask Another Question'
              : 'Request Clarification'}
          </button>
          
          <button
            onClick={() => setShowRejectModal(true)}
            disabled={processing}
            className="btn-danger flex items-center"
          >
            <XCircle className="w-5 h-5 mr-2" />
            Reject Report
          </button>
        </div>
      )}

      {/* Waiting for Response Message */}
      {report.status === 'clarification_requested' && !hasUnreadResponse() && (
        <div className="card bg-yellow-50 border-yellow-200">
          <div className="flex items-center space-x-3">
            <Clock className="w-6 h-6 text-yellow-600" />
            <div>
              <div className="font-semibold text-yellow-900">Waiting for Manager's Response</div>
              <div className="text-sm text-yellow-700 mt-1">
                The manager can see your clarification request in their pending reports.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Reject Report</h2>
            
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="text-sm text-red-800">
                <strong>Note:</strong> Rejecting will require the manager to resubmit the entire report. 
                If you just need more information, consider requesting another clarification instead.
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rejection Reason *
                </label>
                <input
                  type="text"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g., Incomplete data, Incorrect calculations"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Detailed Feedback *
                </label>
                <textarea
                  value={rejectionFeedback}
                  onChange={(e) => setRejectionFeedback(e.target.value)}
                  placeholder="Provide detailed feedback on what needs to be corrected..."
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Resubmission Deadline (Optional)
                </label>
                <input
                  type="date"
                  value={resubmissionDeadline}
                  onChange={(e) => setResubmissionDeadline(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>

            <div className="flex space-x-4 mt-6">
              <button
                onClick={handleReject}
                disabled={processing || !rejectionReason || !rejectionFeedback}
                className="btn-danger flex-1"
              >
                Confirm Rejection
              </button>
              <button
                onClick={() => setShowRejectModal(false)}
                disabled={processing}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clarification Modal */}
      {showClarificationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-2xl w-full mx-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              {report.clarification_thread && report.clarification_thread.length > 0
                ? 'Ask Another Question'
                : 'Request Clarification'}
            </h2>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your Question *
              </label>
              <textarea
                value={clarificationRequest}
                onChange={(e) => setClarificationRequest(e.target.value)}
                placeholder="Ask the manager to clarify specific details..."
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                required
              />
              <p className="mt-2 text-sm text-gray-500">
                The manager will respond without needing to resubmit the entire report.
                {report.clarification_thread && report.clarification_thread.length > 0 && 
                  " This will be added to the existing conversation thread."}
              </p>
            </div>

            <div className="flex space-x-4">
              <button
                onClick={handleRequestClarification}
                disabled={processing || !clarificationRequest.trim()}
                className="px-6 py-2 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 transition-colors flex-1 disabled:opacity-50"
              >
                Send Request
              </button>
              <button
                onClick={() => setShowClarificationModal(false)}
                disabled={processing}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}