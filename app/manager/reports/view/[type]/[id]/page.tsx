'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, CheckCircle, XCircle, Clock, AlertCircle, MessageCircle, Send } from 'lucide-react'
import { format } from 'date-fns'

const formatCurrency = (amount: number | null | undefined) => {
  if (amount == null) return '\u20a60.00'
  return `\u20a6${amount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

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

  const source = searchParams.get('source')
  const backLink = (() => {
    switch (source) {
      case 'approved': return { href: '/manager/reports/approved', label: 'Approved Reports' }
      case 'rejected': return { href: '/manager/reports/rejected', label: 'Rejected Reports' }
      case 'pending':
      default:         return { href: '/manager/reports/pending', label: 'Pending Reports' }
    }
  })()

  useEffect(() => { loadReport() }, [reportType, reportId])

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
        .from(tableName).select('*').eq('id', reportId).single()
      if (reportError) throw reportError
      setReport(reportData)
      if (itemsTableName) {
        const { data: itemsData } = await supabase
          .from(itemsTableName).select('*').eq('report_id', reportId)
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
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data: userData } = await supabase
        .from('users').select('full_name').eq('id', user.id).single()

      const existingThread: any[] = report.clarification_thread || []
      const newMessage = {
        id: crypto.randomUUID(),
        type: 'response',
        author_id: user.id,
        author_name: userData?.full_name || 'Manager',
        author_role: 'manager',
        content: clarificationResponse.trim(),
        timestamp: new Date().toISOString(),
      }
      const updatedThread = [...existingThread, newMessage]

      // FIX: only update clarification_thread
      // Removed clarification_responded_at and clarification_response — these columns do not exist in schema
      const { error } = await supabase
        .from(tableName)
        .update({ clarification_thread: updatedThread })
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
      pending:                 { icon: Clock,       label: 'Pending Review',       className: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
      approved:                { icon: CheckCircle, label: 'Approved',             className: 'bg-green-100 text-green-700 border-green-300' },
      rejected:                { icon: XCircle,     label: 'Rejected',             className: 'bg-red-100 text-red-700 border-red-300' },
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
      stock: 'Stock & Sales Report', stock_inventory: 'Stock & Sales Report',
      sales: 'Sales Report', expense: 'Expense Report',
    }
    return labels[reportType] || 'Report'
  }

  if (loading) return <div className="p-8"><div className="text-lg text-gray-600">Loading report...</div></div>
  if (!report)  return <div className="p-8"><div className="text-lg text-red-600">Report not found</div></div>

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
      legacyThread.push({ id: '1', type: 'question', content: report.clarification_request, timestamp: report.created_at })
    }
    if (report.clarification_response) {
      legacyThread.push({ id: '2', type: 'response', content: report.clarification_response, timestamp: report.created_at })
    }
  }
  const displayThread = clarificationThread.length > 0 ? clarificationThread : legacyThread
  const lastMessage = displayThread[displayThread.length - 1]
  const needsManagerResponse = report.status === 'clarification_requested' && (!lastMessage || lastMessage.type === 'question')

  const isStock = reportType === 'stock' || reportType === 'stock_inventory'
  const previousStockItems = items.filter(i => i.item_section === 'previous_stock')
  const newStockItems      = items.filter(i => i.item_section === 'new_stock')
  const salesLineItems     = items.filter(i => i.item_section === 'sales')

  // Merge previous + new stock into unified table rows (same layout as submission form)
  const stockRows: { item_name: string; previous_qty: number; new_qty: number; total: number }[] = []
  previousStockItems.forEach(prev => {
    const match = newStockItems.find(n => n.item_name === prev.item_name)
    stockRows.push({
      item_name:    prev.item_name,
      previous_qty: prev.quantity ?? 0,
      new_qty:      match?.quantity ?? 0,
      total:        (prev.quantity ?? 0) + (match?.quantity ?? 0),
    })
  })
  newStockItems.forEach(n => {
    if (!stockRows.find(r => r.item_name === n.item_name)) {
      stockRows.push({ item_name: n.item_name, previous_qty: 0, new_qty: n.quantity ?? 0, total: n.quantity ?? 0 })
    }
  })

  const totalSalesRevenue = salesLineItems.reduce((s, i) => s + (i.quantity || 0) * (i.unit_price || 0), 0)
  const totalPayments = (report.cash_payments || 0) + (report.card_payments || 0) + (report.transfer_payments || 0)

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <Link href={backLink.href} className="inline-flex items-center text-primary hover:text-primary-dark mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to {backLink.label}
        </Link>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{getReportTypeLabel()}</h1>
            <p className="text-gray-600 mt-2">Report Date: {format(new Date(report.report_date), 'MMMM dd, yyyy')}</p>
          </div>
          {getStatusBadge()}
        </div>
      </div>

      {/* CLARIFICATION */}
      {(displayThread.length > 0 || report.status === 'clarification_requested') && (
        <div className="card bg-orange-50 border-orange-200 mb-6">
          <h2 className="text-xl font-bold text-orange-900 mb-4 flex items-center">
            <MessageCircle className="w-6 h-6 mr-2" />
            Clarification Conversation
          </h2>
          {displayThread.length > 0 && (
            <div className="space-y-3 mb-4">
              {displayThread.map((message: any) => (
                <div key={message.id} className={`p-4 rounded-lg ${
                  message.type === 'question'
                    ? 'bg-blue-50 border-l-4 border-blue-500'
                    : 'bg-green-50 border-l-4 border-green-500 ml-4'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      message.type === 'question' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                    }`}>
                      {message.type === 'question' ? '\ud83d\udd35 BDM Question' : '\u2705 Your Response'}
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
              <label className="block text-sm font-bold text-orange-900 mb-2">\u270d\ufe0f Your Response to the BDM</label>
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

      {/* STOCK & SALES REPORT */}
      {isStock && (
        <div className="space-y-6">

          {/* SECTION 1: Stock Levels — purple, same as submission form */}
          {stockRows.length > 0 && (
            <div className="card bg-purple-50 border-purple-200">
              <h2 className="text-lg font-bold text-purple-900 mb-4">\ud83d\udce6 Stock Levels</h2>
              <div className="bg-white rounded-lg overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                  <thead className="bg-purple-100">
                    <tr>
                      <th className="px-4 py-3 text-left text-purple-900 font-semibold w-1/3">Item Name</th>
                      <th className="px-4 py-3 text-right text-purple-900 font-semibold">
                        Previous Day's Stock
                        <br /><span className="font-normal text-xs text-purple-600">(Yesterday's Closing)</span>
                      </th>
                      <th className="px-4 py-3 text-right text-purple-900 font-semibold">
                        New Stock Received
                        <br /><span className="font-normal text-xs text-purple-600">(Today's Requisition)</span>
                      </th>
                      <th className="px-4 py-3 text-right text-purple-900 font-semibold bg-purple-200">
                        Total Available
                        <br /><span className="font-normal text-xs text-purple-700">(Previous + New)</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockRows.map((row, i) => (
                      <tr key={i} className="border-t border-purple-100 hover:bg-purple-50/50">
                        <td className="px-4 py-3 font-medium text-gray-900">{row.item_name}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{row.previous_qty.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{row.new_qty.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right font-bold text-purple-900 bg-purple-50">{row.total.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 p-3 bg-purple-100 rounded-lg">
                <p className="text-xs text-purple-800">
                  <strong>Note:</strong> Each row tracks a different item. Focus on the "Total Available" column for each individual item.
                </p>
              </div>
            </div>
          )}

          {/* SECTION 2: Sales — orange, same as submission form */}
          {salesLineItems.length > 0 && (
            <div className="card bg-orange-50 border-orange-200">
              <h2 className="text-lg font-bold text-orange-900 mb-4">\ud83d\uded2 Sales</h2>
              <div className="bg-white rounded-lg overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                  <thead className="bg-orange-100">
                    <tr>
                      <th className="px-4 py-3 text-left text-orange-900 font-semibold">Menu Item</th>
                      <th className="px-4 py-3 text-right text-orange-900 font-semibold">Qty Sold</th>
                      <th className="px-4 py-3 text-right text-orange-900 font-semibold">Unit Price</th>
                      <th className="px-4 py-3 text-right text-orange-900 font-semibold">Total Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salesLineItems.map((item, i) => (
                      <tr key={i} className="border-t border-orange-100 hover:bg-orange-50/50">
                        <td className="px-4 py-3 font-medium text-gray-900">{item.item_name}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{item.quantity}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(item.unit_price)}</td>
                        <td className="px-4 py-3 text-right font-bold text-orange-900">
                          {formatCurrency((item.quantity || 0) * (item.unit_price || 0))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-orange-300">
                      <td colSpan={3} className="px-4 py-3 text-right font-bold text-orange-900 bg-orange-50">Total Sales Revenue</td>
                      <td className="px-4 py-3 text-right font-bold text-orange-900 text-lg bg-orange-50">{formatCurrency(totalSalesRevenue)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* SECTION 3: Payment Methods — same gradient summary style */}
          <div className="card">
            <h2 className="text-lg font-bold text-gray-900 mb-4">\ud83d\udcb0 Payment Methods</h2>
            <div className="p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg border border-gray-200">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-gray-700 font-medium">
                  <span>\ud83d\udcb5 Cash</span>
                  <span>{formatCurrency(report.cash_payments)}</span>
                </div>
                {paymentBreakdown?.card_breakdown?.length > 0 ? (
                  paymentBreakdown.card_breakdown.map((p: any, i: number) => (
                    <div key={i} className="flex justify-between text-blue-600 pl-4 text-xs">
                      <span>\u2937 {p.bank} (Card/POS)</span>
                      <span>{formatCurrency(p.amount)}</span>
                    </div>
                  ))
                ) : (
                  <div className="flex justify-between text-gray-700 font-medium">
                    <span>\ud83d\udcb3 Card / POS</span>
                    <span>{formatCurrency(report.card_payments)}</span>
                  </div>
                )}
                {paymentBreakdown?.transfer_breakdown?.length > 0 ? (
                  paymentBreakdown.transfer_breakdown.map((p: any, i: number) => (
                    <div key={i} className="flex justify-between text-purple-600 pl-4 text-xs">
                      <span>\u2937 {p.bank} (Transfer)</span>
                      <span>{formatCurrency(p.amount)}</span>
                    </div>
                  ))
                ) : (
                  <div className="flex justify-between text-gray-700 font-medium">
                    <span>\ud83c\udfe6 Transfer</span>
                    <span>{formatCurrency(report.transfer_payments)}</span>
                  </div>
                )}
                <div className="border-t-2 border-gray-300 pt-2 flex justify-between font-bold text-gray-900 text-base">
                  <span>Total Payments Received</span>
                  <span>{formatCurrency(totalPayments)}</span>
                </div>
              </div>
              {totalPayments > 0 && totalSalesRevenue > 0 && Math.abs(totalPayments - totalSalesRevenue) > 0.01 && (
                <div className="mt-3 p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded">
                  <p className="text-sm text-yellow-700 font-medium">\u26a0\ufe0f Payment Mismatch</p>
                  <p className="text-xs text-yellow-600 mt-1">
                    Payments ({formatCurrency(totalPayments)}) don't match sales revenue ({formatCurrency(totalSalesRevenue)}).
                    Difference: {formatCurrency(Math.abs(totalPayments - totalSalesRevenue))}
                  </p>
                </div>
              )}
              {totalPayments > 0 && totalSalesRevenue > 0 && Math.abs(totalPayments - totalSalesRevenue) <= 0.01 && (
                <div className="mt-3 p-3 bg-green-50 border-l-4 border-green-400 rounded">
                  <p className="text-sm text-green-700 font-medium">\u2705 Payments Balance Correctly</p>
                  <p className="text-xs text-green-600 mt-1">Total payments match sales revenue exactly</p>
                </div>
              )}
            </div>
          </div>

          {cleanNotes && (
            <div className="card">
              <div className="text-sm font-medium text-gray-700 mb-2">\ud83d\udcdd Additional Notes</div>
              <div className="p-3 bg-gray-50 rounded text-sm text-gray-700 whitespace-pre-wrap">{cleanNotes}</div>
            </div>
          )}
        </div>
      )}

      {/* SALES REPORT */}
      {reportType === 'sales' && (
        <div className="space-y-6">
          <div className="card">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Sales Summary</h2>
            <div className="text-3xl font-bold text-green-600">{formatCurrency(report.total_amount)}</div>
          </div>
          {items.length > 0 && (
            <div className="card bg-orange-50 border-orange-200">
              <h2 className="text-lg font-bold text-orange-900 mb-4">\ud83d\uded2 Items Sold</h2>
              <div className="bg-white rounded-lg overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                  <thead className="bg-orange-100">
                    <tr>
                      <th className="px-4 py-3 text-left text-orange-900 font-semibold">Product</th>
                      <th className="px-4 py-3 text-right text-orange-900 font-semibold">Quantity</th>
                      <th className="px-4 py-3 text-right text-orange-900 font-semibold">Unit Price</th>
                      <th className="px-4 py-3 text-right text-orange-900 font-semibold">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, i) => (
                      <tr key={i} className="border-t border-orange-100">
                        <td className="px-4 py-3 font-medium text-gray-900">{item.product_name}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{item.quantity}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(item.unit_price)}</td>
                        <td className="px-4 py-3 text-right font-bold text-orange-900">{formatCurrency(item.total_price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* EXPENSE REPORT */}
      {reportType === 'expense' && (
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Expense Details</h2>
          {report.total_amount && (
            <div className="text-3xl font-bold text-purple-600 mb-4">{formatCurrency(report.total_amount)}</div>
          )}
        </div>
      )}

      {/* Rejection */}
      {report.status === 'rejected' && report.rejection_reason && (
        <div className="card bg-red-50 border-red-200 mt-6">
          <h2 className="text-xl font-bold text-red-900 mb-4 flex items-center">
            <XCircle className="w-6 h-6 mr-2" /> Rejection Reason
          </h2>
          <p className="text-red-700">{report.rejection_reason}</p>
          {report.rejection_feedback && (
            <div className="mt-3 pt-3 border-t border-red-200">
              <div className="font-semibold text-red-900 mb-1">Feedback:</div>
              <p className="text-red-700">{report.rejection_feedback}</p>
            </div>
          )}
          {report.resubmission_deadline && (
            <div className="mt-3 pt-3 border-t border-red-200">
              <div className="font-semibold text-red-900 mb-1">Resubmission Deadline:</div>
              <p className="text-red-700">{format(new Date(report.resubmission_deadline), 'MMMM dd, yyyy')}</p>
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
          {report.status === 'clarification_requested' && displayThread.length > 0 && (
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-4 h-4 text-orange-600" />
              </div>
              <div>
                <div className="font-semibold text-gray-900">BDM Requested Clarification</div>
                <div className="text-sm text-gray-600">
                  {format(new Date(displayThread[0].timestamp), "MMMM dd, yyyy 'at' h:mm a")}
                </div>
              </div>
            </div>
          )}
          {lastMessage?.type === 'response' && (
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                <MessageCircle className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <div className="font-semibold text-gray-900">You Responded</div>
                <div className="text-sm text-gray-600">
                  {format(new Date(lastMessage.timestamp), "MMMM dd, yyyy 'at' h:mm a")}
                </div>
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