'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, CheckCircle, XCircle, Clock, AlertCircle, MessageCircle, Send } from 'lucide-react'
import { format } from 'date-fns'

export default function ViewReportPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [report, setReport] = useState<any>(null)
  const [items, setItems] = useState<any[]>([])
  const [clarificationResponse, setClarificationResponse] = useState('')
  const [submittingResponse, setSubmittingResponse] = useState(false)

  const reportType = params.type as string
  const reportId = params.id as string

  // ✅ Read source from URL query param — set by whichever list page navigated here
  const source = searchParams.get('source') // 'pending' | 'approved' | 'rejected' | null

  const backLink = (() => {
    switch (source) {
      case 'approved': return { href: '/manager/reports/approved', label: 'Approved Reports' }
      case 'rejected': return { href: '/manager/reports/rejected', label: 'Rejected Reports' }
      case 'pending':
      default:         return { href: '/manager/reports/pending', label: 'Pending Reports' }
    }
  })()

  useEffect(() => {
    loadReport()
  }, [reportType, reportId])

  const getTableNames = (type: string): { tableName: string; itemsTableName: string | null } => {
    switch (type) {
      case 'stock':
      case 'stock_inventory':
        return { tableName: 'stock_inventory_reports', itemsTableName: 'stock_inventory_items' }
      case 'sales':
        return { tableName: 'sales_reports', itemsTableName: 'sales_report_items' }
      case 'expense':
        return { tableName: 'expense_reports', itemsTableName: null }
      default:
        throw new Error(`Unknown report type: ${type}`)
    }
  }

  const loadReport = async () => {
    setLoading(true)
    try {
      const { tableName, itemsTableName } = getTableNames(reportType)

      const { data: reportData, error: reportError } = await supabase
        .from(tableName)
        .select('*')
        .eq('id', reportId)
        .single()

      if (reportError) throw reportError
      setReport(reportData)

      if (itemsTableName) {
        const { data: itemsData } = await supabase
          .from(itemsTableName)
          .select('*')
          .eq('report_id', reportId)
        setItems(itemsData || [])
      }
    } catch (error) {
      console.error('Error loading report:', error)
      alert('Error loading report. Please go back and try again.')
      router.push('/manager/reports/pending')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitClarification = async () => {
    if (!clarificationResponse.trim()) return
    setSubmittingResponse(true)
    try {
      const { tableName } = getTableNames(reportType)

      const existingThread = report.clarification_thread || []
      const updatedThread = [
        ...existingThread,
        {
          id: Date.now().toString(),
          type: 'response',
          content: clarificationResponse.trim(),
          timestamp: new Date().toISOString(),
        },
      ]

      const { error } = await supabase
        .from(tableName)
        .update({
          clarification_response: clarificationResponse.trim(),
          clarification_responded_at: new Date().toISOString(),
          clarification_thread: updatedThread,
        })
        .eq('id', reportId)

      if (error) throw error

      setClarificationResponse('')
      alert('Response submitted! The BDM will review your clarification.')
      loadReport()
    } catch (error: any) {
      console.error('Error submitting clarification:', error)
      alert('Error submitting response: ' + error.message)
    } finally {
      setSubmittingResponse(false)
    }
  }

  const getStatusBadge = () => {
    if (!report) return null
    const statusConfig: Record<string, { icon: any; label: string; className: string }> = {
      pending: { icon: Clock, label: 'Pending Review', className: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
      approved: { icon: CheckCircle, label: 'Approved', className: 'bg-green-100 text-green-700 border-green-300' },
      rejected: { icon: XCircle, label: 'Rejected', className: 'bg-red-100 text-red-700 border-red-300' },
      clarification_requested: { icon: AlertCircle, label: 'Clarification Needed', className: 'bg-orange-100 text-orange-700 border-orange-300' },
    }
    const config = statusConfig[report.status] || statusConfig['pending']
    const Icon = config.icon
    return (
      <div className={`inline-flex items-center px-4 py-2 rounded-lg border-2 ${config.className} font-semibold`}>
        <Icon className="w-5 h-5 mr-2" />
        {config.label}
      </div>
    )
  }

  const getReportTypeLabel = () => {
    const labels: Record<string, string> = {
      stock: 'Stock & Inventory Report',
      stock_inventory: 'Stock & Inventory Report',
      sales: 'Sales Report',
      expense: 'Expense Report',
    }
    return labels[reportType] || 'Report'
  }

  if (loading) {
    return <div className="p-8"><div className="text-lg text-gray-600">Loading report...</div></div>
  }

  if (!report) {
    return <div className="p-8"><div className="text-lg text-red-600">Report not found</div></div>
  }

  // Parse payment breakdown from notes
  let paymentBreakdown: any = null
  let cleanNotes = report.notes || ''
  if (report.notes && report.notes.includes('__PAYMENT_BREAKDOWN__')) {
    const parts = report.notes.split('__PAYMENT_BREAKDOWN__\n')
    cleanNotes = parts[0].trim()
    try { paymentBreakdown = JSON.parse(parts[1]) } catch {}
  }

  const clarificationThread: any[] = report.clarification_thread || []
  const legacyThread: any[] = []
  if (clarificationThread.length === 0) {
    if (report.clarification_request) {
      legacyThread.push({ id: '1', type: 'question', content: report.clarification_request, timestamp: report.clarification_requested_at || report.created_at })
    }
    if (report.clarification_response) {
      legacyThread.push({ id: '2', type: 'response', content: report.clarification_response, timestamp: report.clarification_responded_at || new Date().toISOString() })
    }
  }
  const displayThread = clarificationThread.length > 0 ? clarificationThread : legacyThread
  const lastMessage = displayThread[displayThread.length - 1]
  const needsManagerResponse = report.status === 'clarification_requested' && (!lastMessage || lastMessage.type === 'question')

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-6">

        {/* ✅ Breadcrumb always correct — driven by ?source= query param */}
        <Link href={backLink.href} className="inline-flex items-center text-primary hover:text-primary-dark mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to {backLink.label}
        </Link>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{getReportTypeLabel()}</h1>
            <p className="text-gray-600 mt-2">Report Date: {format(new Date(report.report_date), 'MMMM dd, yyyy')}</p>
          </div>
          {getStatusBadge()}
        </div>
      </div>

      {/* ── CLARIFICATION SECTION ── */}
      {(displayThread.length > 0 || report.status === 'clarification_requested') && (
        <div className="card bg-orange-50 border-orange-200 mb-6">
          <h2 className="text-xl font-bold text-orange-900 mb-4 flex items-center">
            <MessageCircle className="w-6 h-6 mr-2" />
            Clarification Conversation
          </h2>

          {displayThread.length > 0 && (
            <div className="space-y-3 mb-4">
              {displayThread.map((message: any) => (
                <div
                  key={message.id}
                  className={`p-4 rounded-lg ${
                    message.type === 'question'
                      ? 'bg-blue-50 border-l-4 border-blue-500'
                      : 'bg-green-50 border-l-4 border-green-500 ml-4'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      message.type === 'question' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                    }`}>
                      {message.type === 'question' ? '🔵 BDM Question' : '✅ Your Response'}
                    </span>
                    <span className="text-xs text-gray-500">
                      {format(new Date(message.timestamp), 'MMM dd, yyyy h:mm a')}
                    </span>
                  </div>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{message.content}</p>
                </div>
              ))}
            </div>
          )}

          {needsManagerResponse && (
            <div className="mt-4 pt-4 border-t border-orange-200">
              <label className="block text-sm font-bold text-orange-900 mb-2">✍️ Your Response to the BDM</label>
              <textarea
                value={clarificationResponse}
                onChange={(e) => setClarificationResponse(e.target.value)}
                rows={4}
                className="w-full border border-orange-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
                placeholder="Type your clarification response here..."
              />
              <div className="mt-3 flex items-center gap-3">
                <button
                  onClick={handleSubmitClarification}
                  disabled={submittingResponse || !clarificationResponse.trim()}
                  className="flex items-center space-x-2 px-5 py-2.5 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="w-4 h-4" />
                  <span>{submittingResponse ? 'Submitting...' : 'Submit Response'}</span>
                </button>
                <span className="text-xs text-gray-500">The BDM will be notified of your response</span>
              </div>
            </div>
          )}

          {report.status === 'clarification_requested' && lastMessage?.type === 'response' && (
            <div className="mt-4 pt-4 border-t border-orange-200">
              <div className="flex items-center space-x-2 text-green-700 bg-green-50 px-4 py-2 rounded-lg">
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm font-medium">You've responded — waiting for BDM to review and decide.</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── STOCK & INVENTORY REPORT ── */}
      {(reportType === 'stock' || reportType === 'stock_inventory') && (
        <div className="space-y-6">
          {items.filter(i => i.item_section === 'previous_stock').length > 0 && (
            <div className="card">
              <h2 className="text-xl font-bold text-blue-900 mb-4">1. Previous Day's Closing Stock</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-blue-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Item</th>
                      <th className="px-4 py-2 text-right text-sm font-semibold text-gray-700">Quantity</th>
                      <th className="px-4 py-2 text-right text-sm font-semibold text-gray-700">Unit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.filter(i => i.item_section === 'previous_stock').map((item, index) => (
                      <tr key={index} className="border-t">
                        <td className="px-4 py-2 text-sm text-gray-900">{item.item_name}</td>
                        <td className="px-4 py-2 text-sm text-right text-gray-900">{item.quantity}</td>
                        <td className="px-4 py-2 text-sm text-right text-gray-600">{item.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {items.filter(i => i.item_section === 'new_stock').length > 0 && (
            <div className="card">
              <h2 className="text-xl font-bold text-green-900 mb-4">2. New Stock Received</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-green-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Item</th>
                      <th className="px-4 py-2 text-right text-sm font-semibold text-gray-700">Quantity</th>
                      <th className="px-4 py-2 text-right text-sm font-semibold text-gray-700">Unit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.filter(i => i.item_section === 'new_stock').map((item, index) => (
                      <tr key={index} className="border-t">
                        <td className="px-4 py-2 text-sm text-gray-900">{item.item_name}</td>
                        <td className="px-4 py-2 text-sm text-right text-gray-900">{item.quantity}</td>
                        <td className="px-4 py-2 text-sm text-right text-gray-600">{item.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {items.filter(i => i.item_section === 'sales').length > 0 && (
            <div className="card">
              <h2 className="text-xl font-bold text-orange-900 mb-4">3. Sales</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-orange-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Item</th>
                      <th className="px-4 py-2 text-right text-sm font-semibold text-gray-700">Qty Sold</th>
                      <th className="px-4 py-2 text-right text-sm font-semibold text-gray-700">Unit Price</th>
                      <th className="px-4 py-2 text-right text-sm font-semibold text-gray-700">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.filter(i => i.item_section === 'sales').map((item, index) => (
                      <tr key={index} className="border-t">
                        <td className="px-4 py-2 text-sm text-gray-900">{item.item_name}</td>
                        <td className="px-4 py-2 text-sm text-right text-gray-900">{item.quantity}</td>
                        <td className="px-4 py-2 text-sm text-right text-gray-900">₦{item.unit_price?.toLocaleString()}</td>
                        <td className="px-4 py-2 text-sm text-right font-semibold text-gray-900">
                          ₦{((item.quantity || 0) * (item.unit_price || 0)).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-orange-600 text-white font-bold">
                      <td colSpan={3} className="px-4 py-3 text-right">Total Sales Revenue</td>
                      <td className="px-4 py-3 text-right">
                        ₦{items
                          .filter(i => i.item_section === 'sales')
                          .reduce((sum, i) => sum + (i.quantity || 0) * (i.unit_price || 0), 0)
                          .toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          <div className="card">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Payment Methods</h2>
            <div className="space-y-2">
              <div className="flex justify-between p-2 bg-gray-50 rounded">
                <span className="text-gray-700">Cash</span>
                <span className="font-semibold text-gray-900">₦{(report.cash_payments || 0).toLocaleString()}</span>
              </div>
              {paymentBreakdown?.card_breakdown?.length > 0 ? (
                paymentBreakdown.card_breakdown.map((p: any, i: number) => (
                  <div key={i} className="flex justify-between p-2 bg-blue-50 rounded pl-6 text-sm">
                    <span className="text-blue-700">↳ {p.bank} (Card/POS)</span>
                    <span className="font-semibold text-blue-900">₦{p.amount.toLocaleString()}</span>
                  </div>
                ))
              ) : (
                <div className="flex justify-between p-2 bg-gray-50 rounded">
                  <span className="text-gray-700">Card/POS</span>
                  <span className="font-semibold text-gray-900">₦{(report.card_payments || 0).toLocaleString()}</span>
                </div>
              )}
              {paymentBreakdown?.transfer_breakdown?.length > 0 ? (
                paymentBreakdown.transfer_breakdown.map((p: any, i: number) => (
                  <div key={i} className="flex justify-between p-2 bg-purple-50 rounded pl-6 text-sm">
                    <span className="text-purple-700">↳ {p.bank} (Transfer)</span>
                    <span className="font-semibold text-purple-900">₦{p.amount.toLocaleString()}</span>
                  </div>
                ))
              ) : (
                <div className="flex justify-between p-2 bg-gray-50 rounded">
                  <span className="text-gray-700">Transfer</span>
                  <span className="font-semibold text-gray-900">₦{(report.transfer_payments || 0).toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between p-3 bg-gray-900 text-white rounded font-bold">
                <span>Total Payments</span>
                <span>₦{((report.cash_payments || 0) + (report.card_payments || 0) + (report.transfer_payments || 0)).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SALES REPORT ── */}
      {reportType === 'sales' && (
        <div className="space-y-6">
          <div className="card">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Sales Summary</h2>
            <div className="text-3xl font-bold text-green-600">
              ₦{report.total_amount?.toLocaleString('en-NG', { minimumFractionDigits: 2 }) || '0.00'}
            </div>
          </div>
          {items.length > 0 && (
            <div className="card">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Items Sold</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Product</th>
                      <th className="px-4 py-2 text-right text-sm font-semibold text-gray-700">Quantity</th>
                      <th className="px-4 py-2 text-right text-sm font-semibold text-gray-700">Unit Price</th>
                      <th className="px-4 py-2 text-right text-sm font-semibold text-gray-700">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => (
                      <tr key={index} className="border-t">
                        <td className="px-4 py-2 text-sm text-gray-900">{item.product_name}</td>
                        <td className="px-4 py-2 text-sm text-right text-gray-900">{item.quantity}</td>
                        <td className="px-4 py-2 text-sm text-right text-gray-900">₦{item.unit_price?.toLocaleString()}</td>
                        <td className="px-4 py-2 text-sm text-right font-semibold text-gray-900">₦{item.total_price?.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── EXPENSE REPORT ── */}
      {reportType === 'expense' && (
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Expense Details</h2>
          {report.total_amount && (
            <div className="text-3xl font-bold text-purple-600 mb-4">
              ₦{report.total_amount?.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
            </div>
          )}
        </div>
      )}

      {/* Notes */}
      {cleanNotes && (
        <div className="card mt-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Notes</h2>
          <p className="text-gray-700 whitespace-pre-wrap">{cleanNotes}</p>
        </div>
      )}

      {/* Rejection Reason */}
      {report.status === 'rejected' && report.rejection_reason && (
        <div className="card bg-red-50 border-red-200 mt-6">
          <h2 className="text-xl font-bold text-red-900 mb-4 flex items-center">
            <XCircle className="w-6 h-6 mr-2" />
            Rejection Reason
          </h2>
          <p className="text-red-700">{report.rejection_reason}</p>
          {report.rejection_feedback && (
            <div className="mt-3 pt-3 border-t border-red-200">
              <div className="font-semibold text-red-900 mb-1">Feedback:</div>
              <p className="text-red-700">{report.rejection_feedback}</p>
            </div>
          )}
        </div>
      )}

      {/* Timeline */}
      <div className="card mt-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Timeline</h2>
        <div className="space-y-3">
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Clock className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <div className="font-semibold text-gray-900">Submitted</div>
              <div className="text-sm text-gray-600">{format(new Date(report.created_at), "MMMM dd, yyyy 'at' h:mm a")}</div>
            </div>
          </div>

          {(report.clarification_requested_at || (report.status === 'clarification_requested' && displayThread.length > 0)) && (
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-4 h-4 text-orange-600" />
              </div>
              <div>
                <div className="font-semibold text-gray-900">BDM Requested Clarification</div>
                {report.clarification_requested_at && (
                  <div className="text-sm text-gray-600">{format(new Date(report.clarification_requested_at), "MMMM dd, yyyy 'at' h:mm a")}</div>
                )}
              </div>
            </div>
          )}

          {report.clarification_responded_at && (
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                <MessageCircle className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <div className="font-semibold text-gray-900">You Responded</div>
                <div className="text-sm text-gray-600">{format(new Date(report.clarification_responded_at), "MMMM dd, yyyy 'at' h:mm a")}</div>
              </div>
            </div>
          )}

          {report.status === 'approved' && report.reviewed_at && (
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <div className="font-semibold text-gray-900">Approved</div>
                <div className="text-sm text-gray-600">{format(new Date(report.reviewed_at), "MMMM dd, yyyy 'at' h:mm a")}</div>
              </div>
            </div>
          )}

          {report.status === 'rejected' && report.reviewed_at && (
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <XCircle className="w-4 h-4 text-red-600" />
              </div>
              <div>
                <div className="font-semibold text-gray-900">Rejected</div>
                <div className="text-sm text-gray-600">{format(new Date(report.reviewed_at), "MMMM dd, yyyy 'at' h:mm a")}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}