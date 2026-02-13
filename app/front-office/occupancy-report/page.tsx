'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Hotel } from 'lucide-react'
import Link from 'next/link'

export default function OccupancyReportPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0])
  const [totalRooms, setTotalRooms] = useState<number | ''>('')
  const [occupiedRooms, setOccupiedRooms] = useState<number | ''>('')
  const [maintenanceRooms, setMaintenanceRooms] = useState<number | ''>(0)
  const [notes, setNotes] = useState('')

  const total = typeof totalRooms === 'number' ? totalRooms : 0
  const occupied = typeof occupiedRooms === 'number' ? occupiedRooms : 0
  const maintenance = typeof maintenanceRooms === 'number' ? maintenanceRooms : 0
  const vacantRooms = Math.max(0, total - occupied - maintenance)
  const occupancyPct = total > 0 ? ((occupied / total) * 100).toFixed(2) : '0.00'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (total === 0) { alert('Please enter total rooms'); return }
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { error } = await supabase.from('occupancy_reports').insert({
        manager_id: user.id,
        report_date: reportDate,
        total_rooms: total,
        occupied_rooms: occupied,
        vacant_rooms: vacantRooms,
        maintenance_rooms: maintenance,
        occupancy_percentage: parseFloat(occupancyPct),
        notes: notes || null,
        status: 'pending',
      })
      if (error) throw error
      alert('Occupancy report submitted successfully!')
      router.push('/front-office/dashboard')
    } catch (error: any) {
      alert('Error: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <Link href="/front-office/dashboard" className="inline-flex items-center text-primary hover:text-primary-dark mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />Back to Dashboard
        </Link>
        <div className="flex items-center space-x-3">
          <Hotel className="w-8 h-8 text-blue-500" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Room Occupancy Report</h1>
            <p className="text-gray-600 mt-1">Submit daily room status and occupancy</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card">
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Report Date</label>
          <input type="date" value={reportDate} onChange={e => setReportDate(e.target.value)} className="input-field max-w-xs" required />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Total Rooms Available *</label>
            <input type="number" min="0" value={totalRooms}
              onChange={e => setTotalRooms(e.target.value === '' ? '' : parseInt(e.target.value) || 0)}
              className="input-field" placeholder="e.g. 50" required />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Occupied Rooms *</label>
            <input type="number" min="0" value={occupiedRooms}
              onChange={e => setOccupiedRooms(e.target.value === '' ? '' : parseInt(e.target.value) || 0)}
              className="input-field" placeholder="e.g. 32" required />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rooms Under Maintenance
              <span className="ml-1 text-xs text-gray-400">(enter 0 if none)</span>
            </label>
            <input type="number" min="0" value={maintenanceRooms}
              onChange={e => setMaintenanceRooms(e.target.value === '' ? '' : parseInt(e.target.value) || 0)}
              className="input-field" placeholder="0" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Vacant Rooms (Auto-calculated)</label>
            <input type="number" value={vacantRooms} className="input-field bg-gray-100 text-gray-600" disabled />
          </div>
        </div>

        <div className="mb-6 p-4 bg-blue-50 rounded-lg">
          <div className="flex justify-between items-center">
            <span className="text-lg font-semibold text-gray-900">Occupancy Rate:</span>
            <span className="text-3xl font-bold text-blue-600">{occupancyPct}%</span>
          </div>
          <div className="mt-2 text-sm text-gray-600">{occupied} of {total} rooms occupied</div>
          {occupied + maintenance > total && total > 0 && (
            <div className="mt-2 text-sm text-red-600 font-medium">⚠️ Occupied + Maintenance exceeds total rooms</div>
          )}
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Notes (Optional)</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4} className="input-field"
            placeholder="Any additional comments about today's occupancy..." />
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