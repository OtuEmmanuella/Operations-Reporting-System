'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, AlertTriangle } from 'lucide-react'
import Link from 'next/link'

export default function ComplaintReportPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0])
  const [complaintType, setComplaintType] = useState('')
  const [guestName, setGuestName] = useState('')
  const [roomNumber, setRoomNumber] = useState('')
  const [description, setDescription] = useState('')
  const [severity, setSeverity] = useState('')
  const [resolutionStatus, setResolutionStatus] = useState('pending')
  const [resolutionDetails, setResolutionDetails] = useState('')
  const [notes, setNotes] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!complaintType || !severity || !description) {
      alert('Please fill in all required fields')
      return
    }
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { error } = await supabase.from('complaint_reports').insert({
        manager_id: user.id,
        report_date: reportDate,
        complaint_type: complaintType,
        guest_name: guestName || null,
        room_number: roomNumber || null,
        description,
        severity,
        resolution_status: resolutionStatus,
        resolution_details: resolutionDetails || null,
        resolved_at: resolutionStatus === 'resolved' ? new Date().toISOString() : null,
        notes: notes || null,
        status: 'pending',
      })

      if (error) throw error
      alert('Complaint report submitted successfully!')
      router.push('/front-office/dashboard')
    } catch (error: any) {
      alert('Error submitting report: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const severityColors: Record<string, string> = {
    low: 'border-green-400 bg-green-50 text-green-700',
    medium: 'border-yellow-400 bg-yellow-50 text-yellow-700',
    high: 'border-orange-400 bg-orange-50 text-orange-700',
    critical: 'border-red-500 bg-red-50 text-red-700',
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <Link href="/front-office/dashboard" className="inline-flex items-center text-primary hover:text-primary-dark mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />Back to Dashboard
        </Link>
        <div className="flex items-center space-x-3">
          <AlertTriangle className="w-8 h-8 text-red-500" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Complaint Report</h1>
            <p className="text-gray-600 mt-1">Log and track guest complaints and incidents</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Report Date</label>
          <input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)}
            className="input-field max-w-xs" required />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Complaint Type *</label>
            <select value={complaintType} onChange={(e) => setComplaintType(e.target.value)}
              className="input-field" required>
              <option value="">Select type...</option>
              <option value="service">Service</option>
              <option value="room_condition">Room Condition</option>
              <option value="billing">Billing</option>
              <option value="staff_behavior">Staff Behavior</option>
              <option value="amenities">Amenities</option>
              <option value="noise">Noise</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Severity *</label>
            <select value={severity} onChange={(e) => setSeverity(e.target.value)}
              className="input-field" required>
              <option value="">Select severity...</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Guest Name (Optional)</label>
            <input type="text" value={guestName} onChange={(e) => setGuestName(e.target.value)}
              className="input-field" placeholder="Guest full name" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Room Number (Optional)</label>
            <input type="text" value={roomNumber} onChange={(e) => setRoomNumber(e.target.value)}
              className="input-field" placeholder="e.g. 204" />
          </div>
        </div>

        {/* Severity indicator */}
        {severity && (
          <div className={`p-3 rounded-lg border-l-4 text-sm font-medium ${severityColors[severity]}`}>
            {severity === 'critical' && '🚨 CRITICAL — Requires immediate attention and escalation'}
            {severity === 'high' && '⚠️ HIGH — Requires prompt action today'}
            {severity === 'medium' && '⚡ MEDIUM — Address within 24 hours'}
            {severity === 'low' && '✅ LOW — Can be handled in routine follow-up'}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Description *</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4}
            className="input-field" placeholder="Describe the complaint in detail..." required />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Resolution Status</label>
            <select value={resolutionStatus} onChange={(e) => setResolutionStatus(e.target.value)} className="input-field">
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
        </div>

        {(resolutionStatus === 'in_progress' || resolutionStatus === 'resolved') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Resolution Details {resolutionStatus === 'resolved' ? '*' : '(Optional)'}
            </label>
            <textarea value={resolutionDetails} onChange={(e) => setResolutionDetails(e.target.value)} rows={3}
              className="input-field" placeholder="Describe the steps taken to resolve this complaint..."
              required={resolutionStatus === 'resolved'} />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Additional Notes (Optional)</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
            className="input-field" placeholder="Any other relevant information..." />
        </div>

        <div className="flex gap-4">
          <button type="submit" disabled={loading} className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? 'Submitting...' : 'Submit Complaint Report'}
          </button>
          <Link href="/front-office/dashboard" className="btn-secondary">Cancel</Link>
        </div>
      </form>
    </div>
  )
}