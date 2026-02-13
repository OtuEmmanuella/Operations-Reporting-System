'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { ClarificationMessage } from '@/lib/supabase'
import { Hotel, Users, TrendingUp, MessageSquare, XCircle, AlertTriangle, Calendar, ChevronDown, ChevronUp, ArrowLeft, Clock, MessageCircle } from 'lucide-react'
import { format } from 'date-fns'
import Link from 'next/link'

type RType = 'occupancy' | 'guest_activity' | 'revenue' | 'complaint'
interface FOReport {
  id: string; type: RType; report_date: string; status: string; notes?: string
  created_at: string; reviewed_at?: string; rejection_reason?: string
  rejection_feedback?: string; resubmission_deadline?: string
  clarification_thread?: ClarificationMessage[]; extra?: Record<string, any>
}
const ICONS: Record<RType, React.ReactNode> = {
  occupancy: <Hotel className="w-5 h-5 text-indigo-500" />, guest_activity: <Users className="w-5 h-5 text-pink-500" />,
  revenue: <TrendingUp className="w-5 h-5 text-emerald-500" />, complaint: <MessageSquare className="w-5 h-5 text-red-500" />,
}
const LABELS: Record<RType, string> = { occupancy: 'Occupancy Report', guest_activity: 'Guest Activity Report', revenue: 'Revenue Report', complaint: 'Complaint Report' }
const RESUBMIT: Record<RType, string> = { occupancy: '/front-office/occupancy-report', guest_activity: '/front-office/guest-activity-report', revenue: '/front-office/revenue-report', complaint: '/front-office/complaint-report' }

export default function FrontOfficeRejectedPage() {
  const [loading, setLoading] = useState(true)
  const [reports, setReports] = useState<FOReport[]>([])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const [a,b,c,d] = await Promise.all([
        supabase.from('occupancy_reports').select('*').eq('manager_id',user.id).eq('status','rejected').order('reviewed_at',{ascending:false}),
        supabase.from('guest_activity_reports').select('*').eq('manager_id',user.id).eq('status','rejected').order('reviewed_at',{ascending:false}),
        supabase.from('revenue_reports').select('*').eq('manager_id',user.id).eq('status','rejected').order('reviewed_at',{ascending:false}),
        supabase.from('complaint_reports').select('*').eq('manager_id',user.id).eq('status','rejected').order('reviewed_at',{ascending:false}),
      ])
      const all: FOReport[] = [
        ...(a.data||[]).map((r:any)=>({id:r.id,type:'occupancy' as RType,report_date:r.report_date,status:r.status,notes:r.notes,created_at:r.created_at,reviewed_at:r.reviewed_at,rejection_reason:r.rejection_reason,rejection_feedback:r.rejection_feedback,resubmission_deadline:r.resubmission_deadline,clarification_thread:r.clarification_thread||[],extra:{total_rooms:r.total_rooms,occupied_rooms:r.occupied_rooms,vacant_rooms:r.vacant_rooms,maintenance_rooms:r.maintenance_rooms,occupancy_percentage:r.occupancy_percentage}})),
        ...(b.data||[]).map((r:any)=>({id:r.id,type:'guest_activity' as RType,report_date:r.report_date,status:r.status,notes:r.notes,created_at:r.created_at,reviewed_at:r.reviewed_at,rejection_reason:r.rejection_reason,rejection_feedback:r.rejection_feedback,resubmission_deadline:r.resubmission_deadline,clarification_thread:r.clarification_thread||[],extra:{check_ins:r.check_ins,check_outs:r.check_outs,expected_arrivals:r.expected_arrivals,expected_departures:r.expected_departures,walk_ins:r.walk_ins,no_shows:r.no_shows}})),
        ...(c.data||[]).map((r:any)=>({id:r.id,type:'revenue' as RType,report_date:r.report_date,status:r.status,notes:r.notes,created_at:r.created_at,reviewed_at:r.reviewed_at,rejection_reason:r.rejection_reason,rejection_feedback:r.rejection_feedback,resubmission_deadline:r.resubmission_deadline,clarification_thread:r.clarification_thread||[],extra:{room_revenue:r.room_revenue,laundry_revenue:r.laundry_revenue,other_services_revenue:r.other_services_revenue,total_revenue:r.total_revenue,cash_payments:r.cash_payments,card_payments:r.card_payments,transfer_payments:r.transfer_payments}})),
        ...(d.data||[]).map((r:any)=>({id:r.id,type:'complaint' as RType,report_date:r.report_date,status:r.status,notes:r.notes,created_at:r.created_at,reviewed_at:r.reviewed_at,rejection_reason:r.rejection_reason,rejection_feedback:r.rejection_feedback,clarification_thread:r.clarification_thread||[],extra:{complaint_type:r.complaint_type,guest_name:r.guest_name,room_number:r.room_number,description:r.description,severity:r.severity}})),
      ].sort((x,y)=>new Date(y.reviewed_at||y.created_at).getTime()-new Date(x.reviewed_at||x.created_at).getTime())
      setReports(all); setLoading(false)
    })()
  }, [])

  const toggle = (id: string) => setExpanded(prev => { const n=new Set(prev); n.has(id)?n.delete(id):n.add(id); return n })

  if (loading) return <div className="p-8 text-gray-600">Loading...</div>

  return (
    <div className="p-8">
      <div className="mb-8">
        <Link href="/front-office/dashboard" className="inline-flex items-center text-gray-500 hover:text-gray-800 mb-4 text-sm"><ArrowLeft className="w-4 h-4 mr-1"/>Back to Dashboard</Link>
        <h1 className="text-3xl font-bold text-gray-900">Rejected Reports</h1>
        <p className="text-gray-500 mt-1">Review the BDM's feedback and resubmit a corrected report.</p>
      </div>
      {reports.length === 0 ? (
        <div className="card text-center py-16"><XCircle className="w-14 h-14 text-gray-300 mx-auto mb-3"/><h3 className="font-semibold text-gray-700">No rejected reports — great!</h3></div>
      ) : (
        <div className="space-y-4">
          {reports.map(r => {
            const isExpanded = expanded.has(r.id)
            const hasClarThread = (r.clarification_thread||[]).length > 0
            return (
              <div key={r.id} className="card border-l-4 border-red-500 bg-red-50">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1 min-w-0">
                    <div className="mt-0.5">{ICONS[r.type]}</div>
                    <div className="flex-1">
                      <div className="flex items-center flex-wrap gap-2">
                        <span className="font-semibold text-gray-900">{LABELS[r.type]}</span>
                        <span className="status-badge status-rejected">Rejected</span>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3"/>{format(new Date(r.report_date),'MMM dd, yyyy')}</span>
                        {r.reviewed_at&&<span className="flex items-center gap-1"><XCircle className="w-3 h-3 text-red-500"/>Rejected {format(new Date(r.reviewed_at),'MMM dd, h:mm a')}</span>}
                      </div>
                    </div>
                  </div>
                  <button onClick={()=>toggle(r.id)} className="ml-3 text-gray-400 hover:text-gray-600">
                    {isExpanded?<ChevronUp className="w-5 h-5"/>:<ChevronDown className="w-5 h-5"/>}
                  </button>
                </div>

                {/* Rejection info - always visible */}
                <div className="mt-4 space-y-2">
                  {r.rejection_reason&&<div className="bg-white border border-red-200 rounded-lg p-3"><div className="flex items-center gap-1 text-xs font-semibold text-red-700 mb-1"><AlertTriangle className="w-3 h-3"/>Reason</div><p className="text-sm text-gray-800">{r.rejection_reason}</p></div>}
                  {r.rejection_feedback&&<div className="bg-white border border-orange-200 rounded-lg p-3"><div className="text-xs font-semibold text-orange-700 mb-1">What to fix:</div><p className="text-sm text-gray-800">{r.rejection_feedback}</p></div>}
                  {r.resubmission_deadline&&<div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-center gap-2 text-sm"><Clock className="w-4 h-4 text-yellow-600"/><span className="text-yellow-800"><strong>Resubmit by:</strong> {format(new Date(r.resubmission_deadline),'MMM dd, yyyy')}</span></div>}
                  <Link href={RESUBMIT[r.type]} className="inline-flex items-center px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors">
                    Submit New {LABELS[r.type]} →
                  </Link>
                </div>

                {/* Expandable: original data + clarification history */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-red-200 space-y-4">
                    <ReportDetailGrid report={r} />
                    {hasClarThread && (
                      <div>
                        <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-blue-800">
                          <MessageCircle className="w-4 h-4 text-blue-600"/>Clarification History
                        </div>
                        <div className="space-y-2">
                          {(r.clarification_thread||[]).map(msg=>(
                            <div key={msg.id} className={`rounded-lg p-3 text-sm ${msg.type==='question'?'bg-blue-50 border border-blue-200':'bg-green-50 border border-green-200'}`}>
                              <div className="flex justify-between mb-1">
                                <span className={`font-semibold text-xs ${msg.type==='question'?'text-blue-800':'text-green-800'}`}>{msg.type==='question'?`BDM — ${msg.author_name}`:`Your Response — ${msg.author_name}`}</span>
                                <span className="text-xs text-gray-400">{format(new Date(msg.timestamp),'MMM dd, h:mm a')}</span>
                              </div>
                              <p className={msg.type==='question'?'text-blue-800':'text-green-800'}>{msg.content}</p>
                            </div>
                          ))}
                        </div>
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

function ReportDetailGrid({ report }: { report: FOReport }) {
  const e = report.extra || {}
  return (
    <div>
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Original Submitted Data</h4>
      {report.type==='occupancy'&&(<div className="grid grid-cols-3 gap-2">{[['Total Rooms',e.total_rooms],['Occupied',e.occupied_rooms],['Vacant',e.vacant_rooms],['Maintenance',e.maintenance_rooms],['Occupancy Rate',`${e.occupancy_percentage}%`]].map(([l,v])=>(<div key={l as string} className="bg-white p-3 rounded-lg border"><div className="text-xs text-gray-500">{l}</div><div className="font-bold">{v}</div></div>))}</div>)}
      {report.type==='guest_activity'&&(<div className="grid grid-cols-3 gap-2">{[['Check-Ins',e.check_ins],['Check-Outs',e.check_outs],['Expected Arrivals',e.expected_arrivals],['Expected Departures',e.expected_departures],['Walk-Ins',e.walk_ins],['No-Shows',e.no_shows]].map(([l,v])=>(<div key={l as string} className="bg-white p-3 rounded-lg border"><div className="text-xs text-gray-500">{l}</div><div className="font-bold">{v}</div></div>))}</div>)}
      {report.type==='revenue'&&(<div className="space-y-2"><div className="bg-white border p-3 rounded-lg flex justify-between"><span className="text-sm text-gray-600">Total Revenue</span><span className="font-bold text-emerald-700">₦{e.total_revenue?.toLocaleString()}</span></div><div className="grid grid-cols-3 gap-2">{[['Room Revenue',e.room_revenue],['Laundry',e.laundry_revenue],['Other Services',e.other_services_revenue]].map(([l,v])=>(<div key={l as string} className="bg-white p-3 rounded-lg border"><div className="text-xs text-gray-500">{l}</div><div className="font-semibold text-sm">₦{(v as number)?.toLocaleString()}</div></div>))}</div></div>)}
      {report.type==='complaint'&&(<div className="space-y-2"><div className="grid grid-cols-2 gap-2"><div className="bg-white p-3 rounded-lg border"><div className="text-xs text-gray-500">Type</div><div className="font-semibold capitalize">{e.complaint_type?.replace(/_/g,' ')}</div></div><div className="bg-white p-3 rounded-lg border"><div className="text-xs text-gray-500">Severity</div><div className="font-semibold capitalize">{e.severity}</div></div></div><div className="bg-white p-3 rounded-lg border"><div className="text-xs text-gray-500 mb-1">Description</div><p className="text-sm">{e.description}</p></div></div>)}
    </div>
  )
}