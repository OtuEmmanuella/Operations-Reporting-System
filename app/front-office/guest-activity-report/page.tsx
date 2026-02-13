'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Users } from 'lucide-react'
import Link from 'next/link'

export default function GuestActivityReportPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0])
  const [checkIns, setCheckIns] = useState<number | ''>('')
  const [checkOuts, setCheckOuts] = useState<number | ''>('')
  const [expectedArrivals, setExpectedArrivals] = useState<number | ''>('')
  const [expectedDepartures, setExpectedDepartures] = useState<number | ''>('')
  const [walkIns, setWalkIns] = useState<number | ''>('')
  const [noShows, setNoShows] = useState<number | ''>('')
  const [notes, setNotes] = useState('')

  const ci = typeof checkIns === 'number' ? checkIns : 0
  const co = typeof checkOuts === 'number' ? checkOuts : 0
  const wi = typeof walkIns === 'number' ? walkIns : 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { error } = await supabase.from('guest_activity_reports').insert({
        manager_id: user.id,
        report_date: reportDate,
        check_ins: ci,
        check_outs: co,
        expected_arrivals: typeof expectedArrivals === 'number' ? expectedArrivals : 0,
        expected_departures: typeof expectedDepartures === 'number' ? expectedDepartures : 0,
        walk_ins: typeof walkIns === 'number' ? walkIns : 0,
        no_shows: typeof noShows === 'number' ? noShows : 0,
        notes: notes || null,
        status: 'pending',
      })
      if (error) throw error
      alert('Guest activity report submitted successfully!')
      router.push('/front-office/dashboard')
    } catch (error: any) {
      alert('Error: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const numInput = (
    label: string,
    value: number | '',
    setter: (v: number | '') => void,
    required = false,
    hint?: string
  ) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}{required ? ' *' : ''}
        {hint && <span className="ml-1 text-xs text-gray-400">{hint}</span>}
      </label>
      <input type="number" min="0" value={value}
        onChange={e => setter(e.target.value === '' ? '' : parseInt(e.target.value) || 0)}
        className="input-field" placeholder="0" required={required} />
    </div>
  )

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <Link href="/front-office/dashboard" className="inline-flex items-center text-primary hover:text-primary-dark mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />Back to Dashboard
        </Link>
        <div className="flex items-center space-x-3">
          <Users className="w-8 h-8 text-green-500" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Guest Activity Report</h1>
            <p className="text-gray-600 mt-1">Log today's check-ins, check-outs, and guest movements</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card">
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Report Date</label>
          <input type="date" value={reportDate} onChange={e => setReportDate(e.target.value)} className="input-field max-w-xs" required />
        </div>

        <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-3">Actual Activity</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {numInput('Check-Ins Today', checkIns, setCheckIns, true)}
          {numInput('Check-Outs Today', checkOuts, setCheckOuts, true)}
        </div>

        <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-3">
          Additional Details <span className="text-xs text-gray-400 font-normal normal-case">(optional)</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {numInput('Expected Arrivals', expectedArrivals, setExpectedArrivals)}
          {numInput('Expected Departures', expectedDepartures, setExpectedDepartures)}
          {numInput('Walk-Ins', walkIns, setWalkIns)}
          {numInput('No-Shows', noShows, setNoShows)}
        </div>

        <div className="mb-6 p-4 bg-green-50 rounded-lg">
          <h3 className="font-semibold text-gray-900 mb-2">Today's Summary</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-gray-600">Total Activity:</span><span className="ml-2 font-semibold">{ci + co} movements</span></div>
            <div><span className="text-gray-600">Walk-in Rate:</span><span className="ml-2 font-semibold">{ci > 0 ? ((wi / ci) * 100).toFixed(1) : 0}%</span></div>
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Notes (Optional)</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4} className="input-field"
            placeholder="Any notable events, VIP guests, or special circumstances..." />
        </div>

        <div className="flex gap-4">
          <button type="submit" disabled={loading} className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? 'Submitting...' : 'Submit Report'}
          </button>
          <Link href="/front-office/dashboard" className="btn-secondary">Cancel</Link>
        </div>
      </form>
    </div>
  )
}