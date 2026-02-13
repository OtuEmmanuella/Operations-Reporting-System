'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { ClarificationMessage } from '@/lib/supabase'
import { Hotel, Users, TrendingUp, MessageSquare, CheckCircle, Calendar, ChevronDown, ChevronUp, ArrowLeft, MessageCircle } from 'lucide-react'
import { format } from 'date-fns'
import Link from 'next/link'

type RType = 'occupancy' | 'guest_activity' | 'revenue' | 'complaint'
interface FOReport {
  id: string; type: RType; report_date: string; status: string
  notes?: string; created_at: string; reviewed_at?: string
  clarification_thread?: ClarificationMessage[]; extra?: Record<string, any>
}
const ICONS: Record<RType, React.ReactNode> = {
  occupancy: <Hotel className="w-5 h-5 text-indigo-500" />, guest_activity: <Users className="w-5 h-5 text-pink-500" />,
  revenue: <TrendingUp className="w-5 h-5 text-emerald-500" />, complaint: <MessageSquare className="w-5 h-5 text-red-500" />,
}
const LABELS: Record<RType, string> = {
  occupancy: 'Occupancy Report', guest_activity: 'Guest Activity Report', revenue: 'Revenue Report', complaint: 'Complaint Report',
}

export default function FrontOfficeApprovedPage() {
  const [loading, setLoading] = useState(true)
  const [reports, setReports] = useState<FOReport[]>([])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const [a,b,c,d] = await Promise.all([
        supabase.from('occupancy_reports').select('*').eq('manager_id',user.id).eq('status','approved').order('reviewed_at',{ascending:false}),
        supabase.from('guest_activity_reports').select('*').eq('manager_id',user.id).eq('status','approved').order('reviewed_at',{ascending:false}),
        supabase.from('revenue_reports').select('*').eq('manager_id',user.id).eq('status','approved').order('reviewed_at',{ascending:false}),
        supabase.from('complaint_reports').select('*').eq('manager_id',user.id).eq('status','approved').order('reviewed_at',{ascending:false}),
      ])
      const all: FOReport[] = [
        ...(a.data||[]).map((r:any)=>({id:r.id,type:'occupancy' as RType,report_date:r.report_date,status:r.status,notes:r.notes,created_at:r.created_at,reviewed_at:r.reviewed_at,clarification_thread:r.clarification_thread||[],extra:{total_rooms:r.total_rooms,occupied_rooms:r.occupied_rooms,vacant_rooms:r.vacant_rooms,maintenance_rooms:r.maintenance_rooms,occupancy_percentage:r.occupancy_percentage}})),
        ...(b.data||[]).map((r:any)=>({id:r.id,type:'guest_activity' as RType,report_date:r.report_date,status:r.status,notes:r.notes,created_at:r.created_at,reviewed_at:r.reviewed_at,clarification_thread:r.clarification_thread||[],extra:{check_ins:r.check_ins,check_outs:r.check_outs,expected_arrivals:r.expected_arrivals,expected_departures:r.expected_departures,walk_ins:r.walk_ins,no_shows:r.no_shows}})),
        ...(c.data||[]).map((r:any)=>({id:r.id,type:'revenue' as RType,report_date:r.report_date,status:r.status,notes:r.notes,created_at:r.created_at,reviewed_at:r.reviewed_at,clarification_thread:r.clarification_thread||[],extra:{room_revenue:r.room_revenue,laundry_revenue:r.laundry_revenue,other_services_revenue:r.other_services_revenue,total_revenue:r.total_revenue,cash_payments:r.cash_payments,card_payments:r.card_payments,transfer_payments:r.transfer_payments}})),
        ...(d.data||[]).map((r:any)=>({id:r.id,type:'complaint' as RType,report_date:r.report_date,status:r.status,notes:r.notes,created_at:r.created_at,reviewed_at:r.reviewed_at,clarification_thread:r.clarification_thread||[],extra:{complaint_type:r.complaint_type,guest_name:r.guest_name,room_number:r.room_number,description:r.description,severity:r.severity,resolution_status:r.resolution_status,resolution_details:r.resolution_details}})),
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
        <h1 className="text-3xl font-bold text-gray-900">Approved Reports</h1>
        <p className="text-gray-500 mt-1">Reports reviewed and approved by the BDM. Click any report to view full details.</p>
      </div>
      {reports.length === 0 ? (
        <div className="card text-center py-16"><CheckCircle className="w-14 h-14 text-gray-300 mx-auto mb-3"/><h3 className="font-semibold text-gray-700">No approved reports yet</h3></div>
      ) : (
        <div className="space-y-3">
          {reports.map(r => {
            const isExpanded = expanded.has(r.id)
            const hasClarThread = (r.clarification_thread||[]).length > 0
            const userNotes = r.notes?.split('\n__PAYMENT_BREAKDOWN__\n')[0]
            return (
              <div key={r.id} className="card border-l-4 border-green-500 cursor-pointer hover:shadow-md transition-shadow" onClick={()=>toggle(r.id)}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1">
                    <div className="mt-0.5">{ICONS[r.type]}</div>
                    <div className="flex-1">
                      <div className="flex items-center flex-wrap gap-2">
                        <span className="font-semibold text-gray-900">{LABELS[r.type]}</span>
                        <span className="status-badge status-approved">Approved</span>
                        {hasClarThread && <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">Has Clarification History</span>}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3"/>{format(new Date(r.report_date),'MMM dd, yyyy')}</span>
                        <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-green-500"/>Approved {r.reviewed_at?format(new Date(r.reviewed_at),'MMM dd, h:mm a'):'—'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-gray-400 ml-3">{isExpanded?<ChevronUp className="w-5 h-5"/>:<ChevronDown className="w-5 h-5"/>}</div>
                </div>

                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-gray-200 space-y-4" onClick={e=>e.stopPropagation()}>
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
                                <span className={`font-semibold text-xs ${msg.type==='question'?'text-blue-800':'text-green-800'}`}>
                                  {msg.type==='question'?`BDM — ${msg.author_name}`:`Your Response — ${msg.author_name}`}
                                </span>
                                <span className="text-xs text-gray-400">{format(new Date(msg.timestamp),'MMM dd, h:mm a')}</span>
                              </div>
                              <p className={msg.type==='question'?'text-blue-800':'text-green-800'}>{msg.content}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {userNotes&&userNotes.trim()&&<div className="bg-gray-50 p-3 rounded-lg border"><div className="text-xs text-gray-500 mb-1">Notes</div><p className="text-sm text-gray-700">{userNotes}</p></div>}
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
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Report Details</h4>
      {report.type==='occupancy' && (<div className="grid grid-cols-3 gap-2">{[['Total Rooms',e.total_rooms,'bg-gray-50'],['Occupied',e.occupied_rooms,'bg-green-50'],['Vacant',e.vacant_rooms,'bg-blue-50'],['Maintenance',e.maintenance_rooms,'bg-yellow-50'],['Occupancy Rate',`${e.occupancy_percentage}%`,'bg-indigo-50']].map(([l,v,c])=>(<div key={l as string} className={`${c} p-3 rounded-lg`}><div className="text-xs text-gray-500">{l}</div><div className="font-bold">{v}</div></div>))}</div>)}
      {report.type==='guest_activity' && (<div className="grid grid-cols-3 gap-2">{[['Check-Ins',e.check_ins,'bg-green-50'],['Check-Outs',e.check_outs,'bg-blue-50'],['Expected Arrivals',e.expected_arrivals,'bg-indigo-50'],['Expected Departures',e.expected_departures,'bg-purple-50'],['Walk-Ins',e.walk_ins,'bg-pink-50'],['No-Shows',e.no_shows,'bg-red-50']].map(([l,v,c])=>(<div key={l as string} className={`${c} p-3 rounded-lg`}><div className="text-xs text-gray-500">{l}</div><div className="font-bold">{v}</div></div>))}</div>)}
      {report.type==='revenue' && (<div className="space-y-2"><div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg flex justify-between"><span className="text-sm text-gray-600">Total Revenue</span><span className="font-bold text-emerald-700 text-lg">₦{e.total_revenue?.toLocaleString()}</span></div><div className="grid grid-cols-3 gap-2">{[['Room Revenue',e.room_revenue],['Laundry',e.laundry_revenue],['Other Services',e.other_services_revenue]].map(([l,v])=>(<div key={l as string} className="bg-gray-50 p-3 rounded-lg border"><div className="text-xs text-gray-500">{l}</div><div className="font-semibold text-sm">₦{(v as number)?.toLocaleString()}</div></div>))}</div><div className="grid grid-cols-3 gap-2">{[['Cash',e.cash_payments,'text-gray-700'],['Card/POS',e.card_payments,'text-blue-600'],['Transfer',e.transfer_payments,'text-purple-600']].map(([l,v,c])=>(<div key={l as string} className="bg-gray-50 p-3 rounded-lg border text-center"><div className="text-xs text-gray-500">{l}</div><div className={`font-semibold text-sm ${c}`}>₦{(v as number)?.toLocaleString()}</div></div>))}</div></div>)}
      {report.type==='complaint' && (<div className="space-y-2"><div className="grid grid-cols-2 gap-2"><div className="bg-gray-50 p-3 rounded-lg border"><div className="text-xs text-gray-500">Type</div><div className="font-semibold capitalize">{e.complaint_type?.replace(/_/g,' ')}</div></div><div className={`p-3 rounded-lg border ${e.severity==='critical'?'bg-red-50':e.severity==='high'?'bg-orange-50':'bg-yellow-50'}`}><div className="text-xs text-gray-500">Severity</div><div className="font-semibold capitalize">{e.severity}</div></div>{e.guest_name&&<div className="bg-gray-50 p-3 rounded-lg border"><div className="text-xs text-gray-500">Guest</div><div className="font-semibold">{e.guest_name}</div></div>}{e.room_number&&<div className="bg-gray-50 p-3 rounded-lg border"><div className="text-xs text-gray-500">Room</div><div className="font-semibold">{e.room_number}</div></div>}</div><div className="bg-gray-50 p-3 rounded-lg border"><div className="text-xs text-gray-500 mb-1">Description</div><p className="text-sm">{e.description}</p></div>{e.resolution_details&&<div className="bg-green-50 p-3 rounded-lg border border-green-200"><div className="text-xs text-green-700 mb-1">Resolution</div><p className="text-sm text-green-800">{e.resolution_details}</p></div>}</div>)}
    </div>
  )
}