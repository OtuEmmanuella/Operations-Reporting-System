'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { ClarificationMessage } from '@/lib/supabase'
import { Hotel, Users, TrendingUp, MessageSquare, Clock, CheckCircle, XCircle, Calendar, AlertCircle, MessageCircle, AlertTriangle, ArrowLeft } from 'lucide-react'
import { format } from 'date-fns'
import Link from 'next/link'

type ReportType = 'occupancy' | 'guest_activity' | 'revenue' | 'complaint'
type StatusFilter = 'pending' | 'approved' | 'rejected'

interface FrontOfficeReport {
  id: string
  type: ReportType
  report_date: string
  status: 'pending' | 'approved' | 'rejected' | 'clarification_requested'
  notes?: string
  created_at: string
  reviewed_at?: string
  rejection_reason?: string
  rejection_feedback?: string
  resubmission_deadline?: string
  clarification_request?: string
  clarification_response?: string
  clarification_responded_at?: string
  clarification_thread?: ClarificationMessage[]
  // type-specific
  extra?: Record<string, any>
}

const TYPE_LABELS: Record<ReportType, string> = {
  occupancy: 'Occupancy Report',
  guest_activity: 'Guest Activity Report',
  revenue: 'Revenue Report',
  complaint: 'Complaint Report',
}

const TYPE_ICONS: Record<ReportType, React.ReactNode> = {
  occupancy: <Hotel className="w-5 h-5 text-indigo-500" />,
  guest_activity: <Users className="w-5 h-5 text-pink-500" />,
  revenue: <TrendingUp className="w-5 h-5 text-emerald-500" />,
  complaint: <MessageSquare className="w-5 h-5 text-red-500" />,
}

export default function FrontOfficeReportsPage({ statusFilter }: { statusFilter: StatusFilter }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [reports, setReports] = useState<FrontOfficeReport[]>([])
  const [selectedReport, setSelectedReport] = useState<FrontOfficeReport | null>(null)
  const [clarificationResponse, setClarificationResponse] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadReports()
  }, [statusFilter])

  const loadReports = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const statusValues = statusFilter === 'pending'
        ? ['pending', 'clarification_requested']
        : [statusFilter]

      const [occupancyData, guestData, revenueData, complaintData] = await Promise.all([
        supabase.from('occupancy_reports').select('*').eq('manager_id', user.id).in('status', statusValues).order('created_at', { ascending: false }),
        supabase.from('guest_activity_reports').select('*').eq('manager_id', user.id).in('status', statusValues).order('created_at', { ascending: false }),
        supabase.from('revenue_reports').select('*').eq('manager_id', user.id).in('status', statusValues).order('created_at', { ascending: false }),
        supabase.from('complaint_reports').select('*').eq('manager_id', user.id).in('status', statusValues).order('created_at', { ascending: false }),
      ])

      const allReports: FrontOfficeReport[] = [
        ...(occupancyData.data || []).map((r: any) => ({
          id: r.id, type: 'occupancy' as const, report_date: r.report_date,
          status: r.status, notes: r.notes, created_at: r.created_at, reviewed_at: r.reviewed_at,
          rejection_reason: r.rejection_reason, rejection_feedback: r.rejection_feedback,
          resubmission_deadline: r.resubmission_deadline,
          clarification_request: r.clarification_request, clarification_response: r.clarification_response,
          clarification_responded_at: r.clarification_responded_at, clarification_thread: r.clarification_thread || [],
          extra: { total_rooms: r.total_rooms, occupied_rooms: r.occupied_rooms, vacant_rooms: r.vacant_rooms, maintenance_rooms: r.maintenance_rooms, occupancy_percentage: r.occupancy_percentage },
        })),
        ...(guestData.data || []).map((r: any) => ({
          id: r.id, type: 'guest_activity' as const, report_date: r.report_date,
          status: r.status, notes: r.notes, created_at: r.created_at, reviewed_at: r.reviewed_at,
          rejection_reason: r.rejection_reason, rejection_feedback: r.rejection_feedback,
          resubmission_deadline: r.resubmission_deadline,
          clarification_request: r.clarification_request, clarification_response: r.clarification_response,
          clarification_responded_at: r.clarification_responded_at, clarification_thread: r.clarification_thread || [],
          extra: { check_ins: r.check_ins, check_outs: r.check_outs, expected_arrivals: r.expected_arrivals, expected_departures: r.expected_departures, walk_ins: r.walk_ins, no_shows: r.no_shows },
        })),
        ...(revenueData.data || []).map((r: any) => ({
          id: r.id, type: 'revenue' as const, report_date: r.report_date,
          status: r.status, notes: r.notes, created_at: r.created_at, reviewed_at: r.reviewed_at,
          rejection_reason: r.rejection_reason, rejection_feedback: r.rejection_feedback,
          resubmission_deadline: r.resubmission_deadline,
          clarification_request: r.clarification_request, clarification_response: r.clarification_response,
          clarification_responded_at: r.clarification_responded_at, clarification_thread: r.clarification_thread || [],
          extra: { room_revenue: r.room_revenue, food_beverage_revenue: r.food_beverage_revenue, laundry_revenue: r.laundry_revenue, other_services_revenue: r.other_services_revenue, total_revenue: r.total_revenue, cash_payments: r.cash_payments, card_payments: r.card_payments, transfer_payments: r.transfer_payments },
        })),
        ...(complaintData.data || []).map((r: any) => ({
          id: r.id, type: 'complaint' as const, report_date: r.report_date,
          status: r.status, notes: r.notes, created_at: r.created_at, reviewed_at: r.reviewed_at,
          rejection_reason: r.rejection_reason, rejection_feedback: r.rejection_feedback,
          clarification_request: r.clarification_request, clarification_response: r.clarification_response,
          clarification_responded_at: r.clarification_responded_at, clarification_thread: r.clarification_thread || [],
          extra: { complaint_type: r.complaint_type, guest_name: r.guest_name, room_number: r.room_number, description: r.description, severity: r.severity, resolution_status: r.resolution_status, resolution_details: r.resolution_details },
        })),
      ]

      allReports.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      setReports(allReports)
    } catch (error) {
      console.error('Error loading reports:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitClarificationResponse = async (report: FrontOfficeReport) => {
    if (!clarificationResponse.trim()) {
      alert('Please enter your response')
      return
    }
    setSubmitting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const { data: userData } = await supabase.from('users').select('full_name').eq('id', user.id).single()

      const newMessage: ClarificationMessage = {
        id: crypto.randomUUID(),
        type: 'response',
        author_id: user.id,
        author_name: userData?.full_name || 'Front Office Manager',
        author_role: 'manager',
        content: clarificationResponse,
        timestamp: new Date().toISOString(),
      }

      const updatedThread = [...(report.clarification_thread || []), newMessage]

      const tableMap: Record<ReportType, string> = {
        occupancy: 'occupancy_reports',
        guest_activity: 'guest_activity_reports',
        revenue: 'revenue_reports',
        complaint: 'complaint_reports',
      }

      const { error } = await supabase
        .from(tableMap[report.type] as any)
        .update({
          clarification_thread: updatedThread,
          clarification_response: clarificationResponse,
          clarification_responded_at: new Date().toISOString(),
        })
        .eq('id', report.id)

      if (error) throw error

      alert('Response sent successfully!')
      setClarificationResponse('')
      setSelectedReport(null)
      loadReports()
    } catch (error: any) {
      alert('Failed to send response: ' + error.message)
    } finally {
      setSubmitting(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <span className="status-badge status-pending">Pending Review</span>
      case 'approved': return <span className="status-badge status-approved">Approved</span>
      case 'rejected': return <span className="status-badge status-rejected">Rejected</span>
      case 'clarification_requested': return <span className="status-badge status-clarification_requested">Clarification Needed</span>
      default: return null
    }
  }

  const getLastClarificationQuestion = (thread?: ClarificationMessage[]) => {
    if (!thread?.length) return null
    return thread.filter(m => m.type === 'question').pop() || null
  }

  const hasAlreadyResponded = (thread?: ClarificationMessage[]) => {
    if (!thread?.length) return false
    const lastMsg = thread[thread.length - 1]
    return lastMsg.type === 'response'
  }

  if (loading) return <div className="p-8"><div className="text-lg text-gray-600">Loading reports...</div></div>

  const pageTitle = statusFilter === 'pending' ? 'Pending Reports' : statusFilter === 'approved' ? 'Approved Reports' : 'Rejected Reports'
  const emptyMessages = {
    pending: 'No pending reports — all caught up!',
    approved: 'No approved reports yet',
    rejected: 'No rejected reports',
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <Link href="/front-office/dashboard" className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />Back to Dashboard
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">{pageTitle}</h1>
        <p className="text-gray-600 mt-2">
          {statusFilter === 'pending' && 'Reports awaiting BDM review, including any needing clarification from you'}
          {statusFilter === 'approved' && 'Reports that have been reviewed and approved by the BDM'}
          {statusFilter === 'rejected' && 'Reports that were rejected — review feedback and resubmit as needed'}
        </p>
      </div>

      {reports.length === 0 ? (
        <div className="card text-center py-16">
          {statusFilter === 'pending' && <Clock className="w-16 h-16 text-gray-400 mx-auto mb-4" />}
          {statusFilter === 'approved' && <CheckCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />}
          {statusFilter === 'rejected' && <XCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />}
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{emptyMessages[statusFilter]}</h3>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => (
            <div key={`${report.type}-${report.id}`}
              className={`card border-l-4 ${
                report.status === 'clarification_requested' ? 'border-orange-500 bg-orange-50' :
                report.status === 'approved' ? 'border-green-500' :
                report.status === 'rejected' ? 'border-red-500 bg-red-50' :
                'border-yellow-400'
              }`}>
              {/* Report Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start space-x-3">
                  <div className="mt-1">{TYPE_ICONS[report.type]}</div>
                  <div>
                    <div className="flex items-center space-x-3 flex-wrap gap-y-1">
                      <h3 className="text-lg font-semibold text-gray-900">{TYPE_LABELS[report.type]}</h3>
                      {getStatusBadge(report.status)}
                    </div>
                    <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600">
                      <span className="flex items-center space-x-1"><Calendar className="w-4 h-4" /><span>{format(new Date(report.report_date), 'MMM dd, yyyy')}</span></span>
                      <span className="flex items-center space-x-1"><Clock className="w-4 h-4" /><span>Submitted {format(new Date(report.created_at), 'MMM dd, h:mm a')}</span></span>
                      {report.reviewed_at && <span className="flex items-center space-x-1"><CheckCircle className="w-4 h-4" /><span>Reviewed {format(new Date(report.reviewed_at), 'MMM dd, h:mm a')}</span></span>}
                    </div>
                  </div>
                </div>
                <button onClick={() => setSelectedReport(selectedReport?.id === report.id ? null : report)}
                  className="text-sm text-primary hover:text-primary-dark font-medium flex-shrink-0 ml-4">
                  {selectedReport?.id === report.id ? 'Hide Details ▲' : 'View Details ▼'}
                </button>
              </div>

              {/* REJECTION DETAILS */}
              {report.status === 'rejected' && (
                <div className="space-y-3 mb-4">
                  <div className="bg-white p-4 rounded-lg border border-red-200">
                    <div className="text-sm font-semibold text-red-600 mb-2 flex items-center">
                      <AlertTriangle className="w-4 h-4 mr-1" />Rejection Reason:
                    </div>
                    <p className="text-sm text-gray-800">{report.rejection_reason}</p>
                  </div>
                  <div className="bg-white p-4 rounded-lg border border-red-200">
                    <div className="text-sm font-semibold text-gray-700 mb-2">What to fix:</div>
                    <p className="text-sm text-gray-800">{report.rejection_feedback}</p>
                  </div>
                  {report.resubmission_deadline && (
                    <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200 text-sm">
                      <span className="font-semibold text-yellow-800">Resubmission Deadline:</span>
                      <span className="ml-2 text-yellow-700">{format(new Date(report.resubmission_deadline), 'MMM dd, yyyy')}</span>
                    </div>
                  )}
                </div>
              )}

              {/* CLARIFICATION THREAD */}
              {report.status === 'clarification_requested' && report.clarification_thread && report.clarification_thread.length > 0 && (
                <div className="mb-4">
                  <div className="flex items-center space-x-2 mb-3">
                    <MessageCircle className="w-5 h-5 text-orange-600" />
                    <span className="font-semibold text-orange-900">BDM needs clarification from you</span>
                  </div>
                  <div className="space-y-3 mb-4">
                    {report.clarification_thread.map((msg) => (
                      <div key={msg.id} className={`rounded-lg p-4 ${
                        msg.type === 'question' ? 'bg-blue-50 border border-blue-200' : 'bg-green-50 border border-green-200'
                      }`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            {msg.type === 'question'
                              ? <AlertCircle className="w-4 h-4 text-blue-600" />
                              : <CheckCircle className="w-4 h-4 text-green-600" />}
                            <span className={`text-sm font-semibold ${msg.type === 'question' ? 'text-blue-900' : 'text-green-900'}`}>
                              {msg.type === 'question' ? `BDM — ${msg.author_name || 'BDM'}` : `Your Response — ${msg.author_name || 'You'}`}
                            </span>
                          </div>
                          <span className={`text-xs ${msg.type === 'question' ? 'text-blue-600' : 'text-green-600'}`}>
                            {format(new Date(msg.timestamp), 'MMM dd, h:mm a')}
                          </span>
                        </div>
                        <p className={`text-sm whitespace-pre-wrap ${msg.type === 'question' ? 'text-blue-800' : 'text-green-800'}`}>{msg.content}</p>
                      </div>
                    ))}
                  </div>

                  {/* Response box — only show if last message is a question (not yet responded) */}
                  {!hasAlreadyResponded(report.clarification_thread) && (
                    <div className="bg-white border-2 border-orange-300 rounded-lg p-4">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Your Response to BDM:
                      </label>
                      <textarea
                        value={selectedReport?.id === report.id ? clarificationResponse : ''}
                        onChange={(e) => { setSelectedReport(report); setClarificationResponse(e.target.value) }}
                        onClick={() => setSelectedReport(report)}
                        rows={4}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
                        placeholder="Type your clarification here..."
                      />
                      <div className="flex gap-3 mt-3">
                        <button
                          onClick={() => handleSubmitClarificationResponse(report)}
                          disabled={submitting || !clarificationResponse.trim() || selectedReport?.id !== report.id}
                          className="px-5 py-2 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {submitting ? 'Sending...' : 'Send Response'}
                        </button>
                      </div>
                    </div>
                  )}

                  {hasAlreadyResponded(report.clarification_thread) && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
                      ✅ You've responded. Waiting for BDM to review and take action.
                    </div>
                  )}
                </div>
              )}

              {/* EXPANDABLE REPORT DETAILS */}
              {selectedReport?.id === report.id && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Report Details</h4>

                  {report.type === 'occupancy' && report.extra && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {[['Total Rooms', report.extra.total_rooms, 'bg-gray-50'], ['Occupied', report.extra.occupied_rooms, 'bg-green-50'], ['Vacant', report.extra.vacant_rooms, 'bg-blue-50'], ['Maintenance', report.extra.maintenance_rooms, 'bg-yellow-50'], ['Occupancy Rate', `${report.extra.occupancy_percentage}%`, 'bg-indigo-50']].map(([l, v, c]) => (
                        <div key={l as string} className={`${c} p-3 rounded-lg`}><div className="text-xs text-gray-500">{l}</div><div className="font-bold text-gray-900 mt-0.5">{v}</div></div>
                      ))}
                    </div>
                  )}

                  {report.type === 'guest_activity' && report.extra && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {[['Check-Ins', report.extra.check_ins, 'bg-green-50'], ['Check-Outs', report.extra.check_outs, 'bg-blue-50'], ['Expected Arrivals', report.extra.expected_arrivals, 'bg-indigo-50'], ['Expected Departures', report.extra.expected_departures, 'bg-purple-50'], ['Walk-Ins', report.extra.walk_ins, 'bg-pink-50'], ['No-Shows', report.extra.no_shows, 'bg-red-50']].map(([l, v, c]) => (
                        <div key={l as string} className={`${c} p-3 rounded-lg`}><div className="text-xs text-gray-500">{l}</div><div className="font-bold text-gray-900 mt-0.5">{v}</div></div>
                      ))}
                    </div>
                  )}

                  {report.type === 'revenue' && report.extra && (
                    <div className="space-y-3">
                      <div className="p-3 bg-emerald-50 rounded-lg">
                        <div className="text-xs text-gray-500">Total Revenue</div>
                        <div className="text-xl font-bold text-emerald-700">₦{report.extra.total_revenue?.toLocaleString()}</div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {[['Room Revenue', report.extra.room_revenue], ['Food & Beverage', report.extra.food_beverage_revenue], ['Laundry', report.extra.laundry_revenue], ['Other Services', report.extra.other_services_revenue]].map(([l, v]) => (
                          <div key={l as string} className="bg-gray-50 p-3 rounded-lg"><div className="text-xs text-gray-500">{l}</div><div className="font-semibold text-gray-900">₦{(v as number)?.toLocaleString()}</div></div>
                        ))}
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        {[['Cash', report.extra.cash_payments], ['Card', report.extra.card_payments], ['Transfer', report.extra.transfer_payments]].map(([l, v]) => (
                          <div key={l as string} className="bg-gray-50 p-3 rounded-lg text-center"><div className="text-xs text-gray-500">{l}</div><div className="font-semibold text-gray-900 text-sm">₦{(v as number)?.toLocaleString()}</div></div>
                        ))}
                      </div>
                    </div>
                  )}

                  {report.type === 'complaint' && report.extra && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-gray-50 p-3 rounded-lg"><div className="text-xs text-gray-500">Complaint Type</div><div className="font-semibold text-gray-900 capitalize">{report.extra.complaint_type?.replace('_', ' ')}</div></div>
                        <div className={`p-3 rounded-lg ${report.extra.severity === 'critical' ? 'bg-red-50' : report.extra.severity === 'high' ? 'bg-orange-50' : 'bg-yellow-50'}`}><div className="text-xs text-gray-500">Severity</div><div className="font-semibold capitalize">{report.extra.severity}</div></div>
                        {report.extra.guest_name && <div className="bg-gray-50 p-3 rounded-lg"><div className="text-xs text-gray-500">Guest</div><div className="font-semibold text-gray-900">{report.extra.guest_name}</div></div>}
                        {report.extra.room_number && <div className="bg-gray-50 p-3 rounded-lg"><div className="text-xs text-gray-500">Room</div><div className="font-semibold text-gray-900">{report.extra.room_number}</div></div>}
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg"><div className="text-xs text-gray-500 mb-1">Description</div><p className="text-sm text-gray-800">{report.extra.description}</p></div>
                      <div className="bg-gray-50 p-3 rounded-lg"><div className="text-xs text-gray-500">Resolution Status</div><div className="font-semibold text-gray-900 capitalize">{report.extra.resolution_status?.replace('_', ' ')}</div>{report.extra.resolution_details && <p className="text-sm text-gray-600 mt-1">{report.extra.resolution_details}</p>}</div>
                    </div>
                  )}

                  {report.notes && (
                    <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                      <div className="text-xs text-gray-500 mb-1">Notes</div>
                      <p className="text-sm text-gray-700">{report.notes}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}