'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { CheckCircle, ArrowLeft, ChevronDown, ChevronUp, Calendar } from 'lucide-react'
import { format } from 'date-fns'
import Link from 'next/link'

interface Complaint {
  id: string; report_date: string; complaint_type: string
  guest_name: string | null; room_number: string | null
  description: string; severity: string; resolution_status: string
  resolution_details: string | null; resolved_at: string | null; created_at: string
}

const SEVERITY_STYLES: Record<string, string> = {
  critical: 'bg-red-100 text-red-700', high: 'bg-orange-100 text-orange-700',
  medium: 'bg-yellow-100 text-yellow-700', low: 'bg-green-100 text-green-700',
}

export default function ResolvedComplaintsPage() {
  const [loading, setLoading] = useState(true)
  const [complaints, setComplaints] = useState<Complaint[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data } = await supabase.from('complaint_reports').select('*')
      .eq('manager_id', user.id).eq('resolution_status', 'resolved')
      .order('resolved_at', { ascending: false })
    setComplaints(data || [])
    setLoading(false)
  }

  if (loading) return <div className="p-8 text-gray-600">Loading...</div>

  return (
    <div className="p-8">
      <div className="mb-8">
        <Link href="/front-office/complaints" className="inline-flex items-center text-gray-500 hover:text-gray-800 mb-4 text-sm">
          <ArrowLeft className="w-4 h-4 mr-1" />Back to Pending Complaints
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Resolved Complaints</h1>
        <p className="text-gray-500 mt-1">Archive of all resolved guest complaints</p>
      </div>

      {complaints.length === 0 ? (
        <div className="card text-center py-16">
          <CheckCircle className="w-14 h-14 text-gray-300 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-700">No resolved complaints yet</h3>
        </div>
      ) : (
        <div className="space-y-3">
          {complaints.map(c => (
            <div key={c.id} className="card border-l-4 border-l-green-500">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center flex-wrap gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${SEVERITY_STYLES[c.severity] || 'bg-gray-100 text-gray-700'}`}>
                      {c.severity?.toUpperCase()}
                    </span>
                    <span className="text-sm font-semibold text-gray-900 capitalize">{c.complaint_type?.replace('_', ' ')}</span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Resolved</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3"/>{format(new Date(c.report_date), 'MMM dd, yyyy')}</span>
                    {c.guest_name && <span>Guest: <strong>{c.guest_name}</strong></span>}
                    {c.room_number && <span>Room: <strong>{c.room_number}</strong></span>}
                    {c.resolved_at && <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-green-500"/>Resolved {format(new Date(c.resolved_at), 'MMM dd, h:mm a')}</span>}
                  </div>
                  <p className="text-sm text-gray-600 mt-1 line-clamp-1">{c.description}</p>
                </div>
                <button onClick={() => setExpanded(expanded === c.id ? null : c.id)} className="ml-4 text-gray-400 hover:text-gray-600">
                  {expanded === c.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </button>
              </div>
              {expanded === c.id && (
                <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
                  <div className="bg-gray-50 p-3 rounded-lg"><div className="text-xs text-gray-500 mb-1">Description</div><p className="text-sm">{c.description}</p></div>
                  {c.resolution_details && <div className="bg-green-50 p-3 rounded-lg border border-green-200"><div className="text-xs text-green-700 font-semibold mb-1">Resolution</div><p className="text-sm text-green-800">{c.resolution_details}</p></div>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}