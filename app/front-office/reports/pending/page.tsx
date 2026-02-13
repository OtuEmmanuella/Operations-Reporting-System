'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { ClarificationMessage } from '@/lib/supabase'
import { Hotel, Users, TrendingUp, MessageSquare, Clock, Calendar, ChevronDown, ChevronUp, MessageCircle, CheckCircle, ArrowLeft } from 'lucide-react'
import { format } from 'date-fns'
import Link from 'next/link'

type RType = 'occupancy' | 'guest_activity' | 'revenue' | 'complaint'
interface FOReport {
  id: string; type: RType; report_date: string
  status: 'pending' | 'approved' | 'rejected' | 'clarification_requested'
  notes?: string; created_at: string
  clarification_thread?: ClarificationMessage[]
  extra?: Record<string, any>
}
const ICONS: Record<RType, React.ReactNode> = {
  occupancy: <Hotel className="w-5 h-5 text-indigo-500" />,
  guest_activity: <Users className="w-5 h-5 text-pink-500" />,
  revenue: <TrendingUp className="w-5 h-5 text-emerald-500" />,
  complaint: <MessageSquare className="w-5 h-5 text-red-500" />,
}
const LABELS: Record<RType, string> = {
  occupancy: 'Occupancy Report', guest_activity: 'Guest Activity Report',
  revenue: 'Revenue Report', complaint: 'Complaint Report',
}
const TABLE: Record<RType, string> = {
  occupancy: 'occupancy_reports', guest_activity: 'guest_activity_reports',
  revenue: 'revenue_reports', complaint: 'complaint_reports',
}

function mapBase(r: any, type: RType): FOReport {
  return { id: r.id, type, report_date: r.report_date, status: r.status, notes: r.notes, created_at: r.created_at, clarification_thread: r.clarification_thread || [] }
}

export default function FrontOfficePendingPage() {
  const [loading, setLoading] = useState(true)
  const [reports, setReports] = useState<FOReport[]>([])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [responses, setResponses] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const s = ['pending', 'clarification_requested']
    const [a, b, c, d] = await Promise.all([
      supabase.from('occupancy_reports').select('*').eq('manager_id', user.id).in('status', s).order('created_at', { ascending: false }),
      supabase.from('guest_activity_reports').select('*').eq('manager_id', user.id).in('status', s).order('created_at', { ascending: false }),
      supabase.from('revenue_reports').select('*').eq('manager_id', user.id).in('status', s).order('created_at', { ascending: false }),
      supabase.from('complaint_reports').select('*').eq('manager_id', user.id).in('status', s).order('created_at', { ascending: false }),
    ])
    const all: FOReport[] = [
      ...(a.data||[]).map((r:any)=>({...mapBase(r,'occupancy'),extra:{total_rooms:r.total_rooms,occupied_rooms:r.occupied_rooms,vacant_rooms:r.vacant_rooms,maintenance_rooms:r.maintenance_rooms,occupancy_percentage:r.occupancy_percentage}})),
      ...(b.data||[]).map((r:any)=>({...mapBase(r,'guest_activity'),extra:{check_ins:r.check_ins,check_outs:r.check_outs,expected_arrivals:r.expected_arrivals,expected_departures:r.expected_departures,walk_ins:r.walk_ins,no_shows:r.no_shows}})),
      ...(c.data||[]).map((r:any)=>({...mapBase(r,'revenue'),extra:{room_revenue:r.room_revenue,laundry_revenue:r.laundry_revenue,other_services_revenue:r.other_services_revenue,total_revenue:r.total_revenue,cash_payments:r.cash_payments,card_payments:r.card_payments,transfer_payments:r.transfer_payments}})),
      ...(d.data||[]).map((r:any)=>({...mapBase(r,'complaint'),extra:{complaint_type:r.complaint_type,guest_name:r.guest_name,room_number:r.room_number,description:r.description,severity:r.severity,resolution_status:r.resolution_status}})),
    ].sort((x,y)=>new Date(y.created_at).getTime()-new Date(x.created_at).getTime())
    setReports(all)
    setLoading(false)
  }

  const toggle = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const sendResponse = async (r: FOReport) => {
    const text = responses[r.id]?.trim()
    if (!text) return
    setSubmitting(r.id)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const { data: ud } = await supabase.from('users').select('full_name').eq('id', user.id).single()
      const msg: ClarificationMessage = { id: crypto.randomUUID(), type: 'response', author_id: user.id, author_name: ud?.full_name || 'Front Office Manager', author_role: 'manager', content: text, timestamp: new Date().toISOString() }
      const { error } = await supabase.from(TABLE[r.type] as any).update({ clarification_thread: [...(r.clarification_thread||[]), msg], clarification_response: text, clarification_responded_at: new Date().toISOString() }).eq('id', r.id)
      if (error) throw error
      setResponses(p=>({...p,[r.id]:''}))
      load()
    } catch(e:any){ alert('Failed: '+e.message) } finally { setSubmitting(null) }
  }

  const lastIsQuestion = (thread?: ClarificationMessage[]) => !!thread?.length && thread[thread.length-1].type === 'question'

  if (loading) return <div className="p-8 text-gray-600">Loading...</div>

  return (
    <div className="p-8">
      <div className="mb-8">
        <Link href="/front-office/dashboard" className="inline-flex items-center text-gray-500 hover:text-gray-800 mb-4 text-sm">
          <ArrowLeft className="w-4 h-4 mr-1" />Back to Dashboard
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Pending Reports</h1>
        <p className="text-gray-500 mt-1">Awaiting BDM review. Respond to any clarification requests below.</p>
      </div>

      {reports.length === 0 ? (
        <div className="card text-center py-16">
          <Clock className="w-14 h-14 text-gray-300 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-700">No pending reports — all caught up!</h3>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map(r => {
            const isExpanded = expanded.has(r.id)
            const hasClar = r.status === 'clarification_requested' && (r.clarification_thread||[]).length > 0
            return (
              <div key={r.id} className={`card border-l-4 ${r.status==='clarification_requested'?'border-orange-500 bg-orange-50':'border-yellow-400'}`}>
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1 min-w-0">
                    <div className="mt-0.5 flex-shrink-0">{ICONS[r.type]}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center flex-wrap gap-2">
                        <span className="font-semibold text-gray-900">{LABELS[r.type]}</span>
                        {r.status==='clarification_requested'
                          ? <span className="status-badge status-clarification_requested">Clarification Needed</span>
                          : <span className="status-badge status-pending">Pending Review</span>}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3"/>{format(new Date(r.report_date),'MMM dd, yyyy')}</span>
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3"/>Submitted {format(new Date(r.created_at),'MMM dd, h:mm a')}</span>
                      </div>
                    </div>
                  </div>
                  <button onClick={()=>toggle(r.id)} className="ml-3 flex-shrink-0 flex items-center gap-1 text-xs text-primary hover:text-primary-dark font-medium">
                    {isExpanded ? <><ChevronUp className="w-4 h-4"/>Hide</>: <><ChevronDown className="w-4 h-4"/>Details</>}
                  </button>
                </div>

                {/* Report details - always expanded when viewing */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <ReportDetailGrid report={r} />
                  </div>
                )}

                {/* Clarification thread */}
                {hasClar && (
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-orange-800">
                      <MessageCircle className="w-4 h-4 text-orange-600"/>BDM needs clarification from you
                    </div>
                    {(r.clarification_thread||[]).map(msg=>(
                      <div key={msg.id} className={`rounded-lg p-3 text-sm ${msg.type==='question'?'bg-blue-50 border border-blue-200':'bg-green-50 border border-green-200'}`}>
                        <div className="flex justify-between mb-1">
                          <span className={`font-semibold text-xs ${msg.type==='question'?'text-blue-800':'text-green-800'}`}>
                            {msg.type==='question'?`BDM — ${msg.author_name}`:`Your Response — ${msg.author_name}`}
                          </span>
                          <span className="text-xs text-gray-400">{format(new Date(msg.timestamp),'MMM dd, h:mm a')}</span>
                        </div>
                        <p className={msg.type==='question'?'text-blue-800':'text-green-800'}>{msg.content}</p>
                      </div>
                    ))}
                    {lastIsQuestion(r.clarification_thread) ? (
                      <div className="bg-white border-2 border-orange-300 rounded-lg p-4">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Your Response:</label>
                        <textarea value={responses[r.id]||''} onChange={e=>setResponses(p=>({...p,[r.id]:e.target.value}))}
                          rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 resize-none text-sm"
                          placeholder="Type your response to the BDM here..." />
                        <button onClick={()=>sendResponse(r)} disabled={submitting===r.id||!responses[r.id]?.trim()}
                          className="mt-2 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50">
                          {submitting===r.id?'Sending...':'Send Response'}
                        </button>
                      </div>
                    ) : (
                      <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">
                        ✅ Response sent — waiting for BDM to take action.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function ReportDetailGrid({ report }: { report: FOReport }) {
  const e = report.extra || {}
  const userNotes = report.notes?.split('\n__PAYMENT_BREAKDOWN__\n')[0]
  return (
    <div>
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Report Details</h4>
      {report.type==='occupancy' && (
        <div className="grid grid-cols-3 gap-2">
          {[['Total Rooms',e.total_rooms,'bg-gray-50'],['Occupied',e.occupied_rooms,'bg-green-50'],['Vacant',e.vacant_rooms,'bg-blue-50'],['Maintenance',e.maintenance_rooms,'bg-yellow-50'],['Occupancy Rate',`${e.occupancy_percentage}%`,'bg-indigo-50']].map(([l,v,c])=>(
            <div key={l as string} className={`${c} p-3 rounded-lg`}><div className="text-xs text-gray-500">{l}</div><div className="font-bold">{v}</div></div>
          ))}
        </div>
      )}
      {report.type==='guest_activity' && (
        <div className="grid grid-cols-3 gap-2">
          {[['Check-Ins',e.check_ins,'bg-green-50'],['Check-Outs',e.check_outs,'bg-blue-50'],['Expected Arrivals',e.expected_arrivals,'bg-indigo-50'],['Expected Departures',e.expected_departures,'bg-purple-50'],['Walk-Ins',e.walk_ins,'bg-pink-50'],['No-Shows',e.no_shows,'bg-red-50']].map(([l,v,c])=>(
            <div key={l as string} className={`${c} p-3 rounded-lg`}><div className="text-xs text-gray-500">{l}</div><div className="font-bold">{v}</div></div>
          ))}
        </div>
      )}
      {report.type==='revenue' && (
        <div className="space-y-2">
          <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg flex justify-between items-center">
            <span className="text-sm text-gray-600">Total Revenue</span>
            <span className="font-bold text-emerald-700 text-lg">₦{e.total_revenue?.toLocaleString()}</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[['Room Revenue',e.room_revenue],['Laundry',e.laundry_revenue],['Other Services',e.other_services_revenue]].map(([l,v])=>(
              <div key={l as string} className="bg-gray-50 p-3 rounded-lg border"><div className="text-xs text-gray-500">{l}</div><div className="font-semibold text-sm">₦{(v as number)?.toLocaleString()}</div></div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[['Cash',e.cash_payments,'text-gray-700'],['Card/POS',e.card_payments,'text-blue-600'],['Transfer',e.transfer_payments,'text-purple-600']].map(([l,v,c])=>(
              <div key={l as string} className="bg-gray-50 p-3 rounded-lg border text-center"><div className="text-xs text-gray-500">{l}</div><div className={`font-semibold text-sm ${c}`}>₦{(v as number)?.toLocaleString()}</div></div>
            ))}
          </div>
        </div>
      )}
      {report.type==='complaint' && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-gray-50 p-3 rounded-lg border"><div className="text-xs text-gray-500">Type</div><div className="font-semibold capitalize">{e.complaint_type?.replace(/_/g,' ')}</div></div>
            <div className={`p-3 rounded-lg border ${e.severity==='critical'?'bg-red-50':e.severity==='high'?'bg-orange-50':'bg-yellow-50'}`}><div className="text-xs text-gray-500">Severity</div><div className="font-semibold capitalize">{e.severity}</div></div>
            {e.guest_name&&<div className="bg-gray-50 p-3 rounded-lg border"><div className="text-xs text-gray-500">Guest</div><div className="font-semibold">{e.guest_name}</div></div>}
            {e.room_number&&<div className="bg-gray-50 p-3 rounded-lg border"><div className="text-xs text-gray-500">Room</div><div className="font-semibold">{e.room_number}</div></div>}
          </div>
          <div className="bg-gray-50 p-3 rounded-lg border"><div className="text-xs text-gray-500 mb-1">Description</div><p className="text-sm">{e.description}</p></div>
          <div className="bg-gray-50 p-3 rounded-lg border"><div className="text-xs text-gray-500">Resolution Status</div><div className="font-semibold capitalize">{e.resolution_status?.replace(/_/g,' ')}</div></div>
        </div>
      )}
      {userNotes&&userNotes.trim()&&<div className="mt-2 bg-white p-3 rounded-lg border"><div className="text-xs text-gray-500 mb-1">Notes</div><p className="text-sm text-gray-700">{userNotes}</p></div>}
    </div>
  )
}