'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { AlertTriangle, CheckCircle, Clock, ArrowLeft, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import Link from 'next/link'

interface Complaint {
  id: string
  report_date: string
  complaint_type: string
  guest_name: string | null
  room_number: string | null
  description: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  resolution_status: 'pending' | 'in_progress' | 'resolved'
  resolution_details: string | null
  created_at: string
  status: string
}

const SEVERITY_STYLES: Record<string, string> = {
  critical: 'bg-red-100 text-red-800 border-red-300',
  high: 'bg-orange-100 text-orange-800 border-orange-300',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  low: 'bg-green-100 text-green-800 border-green-300',
}

const SEVERITY_BORDER: Record<string, string> = {
  critical: 'border-l-red-500',
  high: 'border-l-orange-500',
  medium: 'border-l-yellow-400',
  low: 'border-l-green-400',
}

export default function PendingComplaintsPage() {
  const [loading, setLoading] = useState(true)
  const [complaints, setComplaints] = useState<Complaint[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [resolutionText, setResolutionText] = useState<Record<string, string>>({})
  const [updating, setUpdating] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data } = await supabase
      .from('complaint_reports')
      .select('*')
      .eq('manager_id', user.id)
      .in('resolution_status', ['pending', 'in_progress'])
      .order('created_at', { ascending: false })
    setComplaints(data || [])
    setLoading(false)
  }

  const updateStatus = async (complaint: Complaint, newStatus: 'in_progress' | 'resolved') => {
    if (newStatus === 'resolved' && !resolutionText[complaint.id]?.trim()) {
      alert('Please enter resolution details before marking as resolved')
      return
    }
    setUpdating(complaint.id)
    try {
      const { error } = await supabase.from('complaint_reports').update({
        resolution_status: newStatus,
        resolution_details: newStatus === 'resolved'
          ? resolutionText[complaint.id]
          : (complaint.resolution_details || resolutionText[complaint.id] || null),
        resolved_at: newStatus === 'resolved' ? new Date().toISOString() : null,
      }).eq('id', complaint.id)
      if (error) throw error
      load()
    } catch (e: any) {
      alert('Failed to update: ' + e.message)
    } finally {
      setUpdating(null)
    }
  }

  if (loading) return <div className="p-8 text-gray-600">Loading complaints...</div>

  return (
    <div className="p-8">
      <div className="mb-8">
        <Link href="/front-office/dashboard" className="inline-flex items-center text-gray-500 hover:text-gray-800 mb-4 text-sm">
          <ArrowLeft className="w-4 h-4 mr-1" />Back to Dashboard
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Pending Complaints</h1>
            <p className="text-gray-500 mt-1">Active guest complaints requiring attention or follow-up</p>
          </div>
          <Link href="/front-office/complaints/resolved" className="btn-secondary text-sm">
            View Resolved →
          </Link>
        </div>
      </div>

      {complaints.length === 0 ? (
        <div className="card text-center py-16">
          <CheckCircle className="w-14 h-14 text-green-400 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-700 text-lg">All clear!</h3>
          <p className="text-gray-400 mt-1">No pending or in-progress complaints.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {complaints.map(c => (
            <div key={c.id} className={`card border-l-4 ${SEVERITY_BORDER[c.severity] || 'border-l-gray-300'}`}>
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center flex-wrap gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${SEVERITY_STYLES[c.severity]}`}>
                      {c.severity.toUpperCase()}
                    </span>
                    <span className="text-sm font-semibold text-gray-900 capitalize">{c.complaint_type.replace('_', ' ')}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      c.resolution_status === 'in_progress' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {c.resolution_status === 'in_progress' ? 'In Progress' : 'Pending'}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                    <span>{format(new Date(c.report_date), 'MMM dd, yyyy')}</span>
                    {c.guest_name && <span>Guest: <strong>{c.guest_name}</strong></span>}
                    {c.room_number && <span>Room: <strong>{c.room_number}</strong></span>}
                  </div>
                  <p className="text-sm text-gray-700 mt-2 line-clamp-2">{c.description}</p>
                </div>
                <button onClick={() => setExpanded(expanded === c.id ? null : c.id)} className="ml-4 flex-shrink-0 text-gray-400 hover:text-gray-600">
                  {expanded === c.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </button>
              </div>

              {/* Action buttons - always visible */}
              <div className="mt-4 flex items-center gap-3 flex-wrap">
                {c.resolution_status === 'pending' && (
                  <button
                    onClick={() => updateStatus(c, 'in_progress')}
                    disabled={updating === c.id}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    {updating === c.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Clock className="w-3 h-3" />}
                    Mark In Progress
                  </button>
                )}
                <button
                  onClick={() => setExpanded(c.id)}
                  className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700"
                >
                  Mark Resolved ↓
                </button>
              </div>

              {/* Expanded: full details + resolve form */}
              {expanded === c.id && (
                <div className="mt-4 pt-4 border-t border-gray-200 space-y-4">
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Full Description</div>
                    <p className="text-sm text-gray-800">{c.description}</p>
                  </div>
                  {c.resolution_details && (
                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                      <div className="text-xs font-semibold text-blue-700 mb-1">Current Resolution Notes</div>
                      <p className="text-sm text-blue-800">{c.resolution_details}</p>
                    </div>
                  )}

                  {/* Resolve form */}
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Resolution Details {c.resolution_status === 'pending' ? '(required to resolve)' : ''}
                    </label>
                    <textarea
                      value={resolutionText[c.id] || ''}
                      onChange={e => setResolutionText(prev => ({ ...prev, [c.id]: e.target.value }))}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 resize-none text-sm"
                      placeholder="Describe how this complaint was resolved..."
                    />
                    <div className="flex gap-3 mt-3 flex-wrap">
                      <button
                        onClick={() => updateStatus(c, 'resolved')}
                        disabled={updating === c.id || !resolutionText[c.id]?.trim()}
                        className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                      >
                        {updating === c.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                        Mark as Resolved
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}