'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Hotel, Users, DollarSign, AlertTriangle, TrendingUp, Clock, CheckCircle, XCircle, ChevronRight, MessageSquare, Plus, BarChart3 } from 'lucide-react'
import Link from 'next/link'

interface DashboardStats {
  occupancy_percentage: number; total_rooms: number; occupied_rooms: number
  vacant_rooms: number; maintenance_rooms: number; today_check_ins: number
  today_check_outs: number; today_revenue: number
  pending_complaints: number; in_progress_complaints: number
  pending_reports: number; clarification_reports: number
}

export default function FrontOfficeDashboard() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [userName, setUserName] = useState('')

  useEffect(() => { loadDashboardData() }, [])

  const loadDashboardData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const today = new Date().toISOString().split('T')[0]

      const [occ, guest, rev, comp, ud, pOcc, pGuest, pRev, pComp] = await Promise.all([
        supabase.from('occupancy_reports').select('*').eq('manager_id', user.id).eq('report_date', today).maybeSingle(),
        supabase.from('guest_activity_reports').select('*').eq('manager_id', user.id).eq('report_date', today).maybeSingle(),
        supabase.from('revenue_reports').select('total_revenue').eq('manager_id', user.id).eq('report_date', today).maybeSingle(),
        supabase.from('complaint_reports').select('resolution_status').eq('manager_id', user.id).in('resolution_status', ['pending', 'in_progress']),
        supabase.from('users').select('full_name').eq('id', user.id).single(),
        supabase.from('occupancy_reports').select('status').eq('manager_id', user.id).in('status', ['pending', 'clarification_requested']),
        supabase.from('guest_activity_reports').select('status').eq('manager_id', user.id).in('status', ['pending', 'clarification_requested']),
        supabase.from('revenue_reports').select('status').eq('manager_id', user.id).in('status', ['pending', 'clarification_requested']),
        supabase.from('complaint_reports').select('status').eq('manager_id', user.id).in('status', ['pending', 'clarification_requested']),
      ])

      setUserName(ud.data?.full_name?.split(' ')[0] || '')
      const allPending = [...(pOcc.data||[]),...(pGuest.data||[]),...(pRev.data||[]),...(pComp.data||[])]
      const complaintList = comp.data || []

      setStats({
        occupancy_percentage: occ.data?.occupancy_percentage || 0,
        total_rooms: occ.data?.total_rooms || 0,
        occupied_rooms: occ.data?.occupied_rooms || 0,
        vacant_rooms: occ.data?.vacant_rooms || 0,
        maintenance_rooms: occ.data?.maintenance_rooms || 0,
        today_check_ins: guest.data?.check_ins || 0,
        today_check_outs: guest.data?.check_outs || 0,
        today_revenue: rev.data?.total_revenue || 0,
        pending_complaints: complaintList.filter(c => c.resolution_status === 'pending').length,
        in_progress_complaints: complaintList.filter(c => c.resolution_status === 'in_progress').length,
        pending_reports: allPending.filter(r => r.status === 'pending').length,
        clarification_reports: allPending.filter(r => r.status === 'clarification_requested').length,
      })
    } catch (error) {
      console.error('Error loading dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return (
    <div className="p-8 flex items-center justify-center min-h-screen">
      <div className="text-gray-400">Loading dashboard...</div>
    </div>
  )

  const totalActiveComplaints = (stats?.pending_complaints || 0) + (stats?.in_progress_complaints || 0)
  const totalPendingReports = (stats?.pending_reports || 0) + (stats?.clarification_reports || 0)

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Welcome */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}{userName ? `, ${userName}` : ''}! 👋
        </h1>
        <p className="text-gray-500 mt-1">Here's today's overview — {new Date().toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      </div>

      {/* Alert banners */}
      {(stats?.clarification_reports || 0) > 0 && (
        <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <MessageSquare className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="font-semibold text-orange-900 text-sm">Response Required</p>
              <p className="text-orange-700 text-xs">BDM has requested clarification on {stats?.clarification_reports} report{(stats?.clarification_reports||0)>1?'s':''}</p>
            </div>
          </div>
          <Link href="/front-office/reports/pending" className="px-3 py-1.5 bg-orange-600 text-white text-xs font-medium rounded-lg hover:bg-orange-700">Respond Now →</Link>
        </div>
      )}

      {/* Metric cards row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Occupancy Rate', value: `${stats?.occupancy_percentage.toFixed(1)}%`, sub: `${stats?.occupied_rooms}/${stats?.total_rooms} rooms`, icon: Hotel, color: 'bg-blue-500', bg: 'bg-blue-50', text: 'text-blue-600' },
          { label: "Today's Check-ins", value: stats?.today_check_ins, sub: `Check-outs: ${stats?.today_check_outs}`, icon: Users, color: 'bg-green-500', bg: 'bg-green-50', text: 'text-green-600' },
          { label: "Today's Revenue", value: `₦${(stats?.today_revenue || 0).toLocaleString()}`, sub: 'Daily total', icon: DollarSign, color: 'bg-purple-500', bg: 'bg-purple-50', text: 'text-purple-600' },
          { label: 'Active Complaints', value: totalActiveComplaints, sub: totalActiveComplaints === 0 ? 'All clear!' : `${stats?.in_progress_complaints} in progress`, icon: AlertTriangle, color: totalActiveComplaints > 0 ? 'bg-red-500' : 'bg-gray-400', bg: totalActiveComplaints > 0 ? 'bg-red-50' : 'bg-gray-50', text: totalActiveComplaints > 0 ? 'text-red-600' : 'text-gray-500' },
        ].map(({ label, value, sub, icon: Icon, color, bg, text }) => (
          <div key={label} className="card">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-gray-500 mb-1">{label}</div>
                <div className={`text-2xl font-bold text-gray-900`}>{value}</div>
                <div className="text-xs text-gray-400 mt-0.5">{sub}</div>
              </div>
              <div className={`w-10 h-10 ${color} rounded-xl flex items-center justify-center flex-shrink-0 ml-2`}>
                <Icon className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">

        {/* Room Status */}
        <div className="card">
          <h2 className="text-base font-bold text-gray-900 mb-4">Room Status</h2>
          <div className="space-y-2.5">
            {[
              { label: 'Occupied', value: stats?.occupied_rooms, color: 'bg-green-500', bg: 'bg-green-50', text: 'text-green-700' },
              { label: 'Vacant', value: stats?.vacant_rooms, color: 'bg-blue-500', bg: 'bg-blue-50', text: 'text-blue-700' },
              { label: 'Maintenance', value: stats?.maintenance_rooms, color: 'bg-amber-500', bg: 'bg-amber-50', text: 'text-amber-700' },
            ].map(({ label, value, color, bg, text }) => (
              <div key={label} className={`flex items-center justify-between px-4 py-3 ${bg} rounded-lg`}>
                <div className="flex items-center space-x-2.5">
                  <div className={`w-2.5 h-2.5 ${color} rounded-full`}></div>
                  <span className="text-sm font-medium text-gray-800">{label}</span>
                </div>
                <span className={`text-xl font-bold ${text}`}>{value}</span>
              </div>
            ))}
          </div>
          {stats?.total_rooms ? (
            <div className="mt-3 bg-gray-100 rounded-full h-2 overflow-hidden">
              <div className="bg-green-500 h-2 rounded-full" style={{ width: `${stats.occupancy_percentage}%` }}></div>
            </div>
          ) : null}
        </div>

        {/* Quick Actions */}
        <div className="card">
          <h2 className="text-base font-bold text-gray-900 mb-4">Submit Report</h2>
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { title: 'Occupancy', href: '/front-office/occupancy-report', icon: Hotel, color: 'bg-blue-500' },
              { title: 'Guest Activity', href: '/front-office/guest-activity-report', icon: Users, color: 'bg-green-500' },
              { title: 'Revenue', href: '/front-office/revenue-report', icon: TrendingUp, color: 'bg-purple-500' },
              { title: 'Complaint', href: '/front-office/complaint-report', icon: AlertTriangle, color: 'bg-red-500' },
            ].map(action => {
              const Icon = action.icon
              return (
                <Link key={action.href} href={action.href}>
                  <div className="p-3 border border-gray-200 rounded-xl hover:shadow-md hover:border-gray-300 transition-all cursor-pointer group">
                    <div className={`w-9 h-9 ${action.color} rounded-lg flex items-center justify-center mb-2 group-hover:scale-105 transition-transform`}>
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                    <div className="text-xs font-semibold text-gray-800">{action.title}</div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>

        {/* Reports & Complaints Status */}
        <div className="card">
          <h2 className="text-base font-bold text-gray-900 mb-4">Status Overview</h2>
          <div className="space-y-2">
            <Link href="/front-office/reports/pending" className="flex items-center justify-between p-3 rounded-lg border border-yellow-200 bg-yellow-50 hover:bg-yellow-100 transition-colors">
              <div className="flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-yellow-600" />
                <div>
                  <div className="text-sm font-semibold text-gray-800">Pending Reports</div>
                  {(stats?.clarification_reports||0) > 0 && <div className="text-xs text-orange-600">{stats?.clarification_reports} need response</div>}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-base font-bold text-yellow-700">{totalPendingReports}</span>
                <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
              </div>
            </Link>

            <Link href="/front-office/reports/approved" className="flex items-center justify-between p-3 rounded-lg border border-green-200 bg-green-50 hover:bg-green-100 transition-colors">
              <div className="flex items-center gap-2.5">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <div className="text-sm font-semibold text-gray-800">Approved Reports</div>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
            </Link>

            <Link href="/front-office/reports/rejected" className="flex items-center justify-between p-3 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 transition-colors">
              <div className="flex items-center gap-2.5">
                <XCircle className="w-4 h-4 text-red-500" />
                <div className="text-sm font-semibold text-gray-800">Rejected Reports</div>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
            </Link>

            <div className="border-t border-gray-100 my-2"></div>

            <Link href="/front-office/complaints" className="flex items-center justify-between p-3 rounded-lg border border-orange-200 bg-orange-50 hover:bg-orange-100 transition-colors">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-4 h-4 text-orange-500" />
                <div>
                  <div className="text-sm font-semibold text-gray-800">Pending Complaints</div>
                  {totalActiveComplaints > 0 && <div className="text-xs text-orange-600">{stats?.in_progress_complaints} in progress</div>}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-base font-bold text-orange-700">{totalActiveComplaints}</span>
                <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
              </div>
            </Link>

            <Link href="/front-office/complaints/resolved" className="flex items-center justify-between p-3 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors">
              <div className="flex items-center gap-2.5">
                <CheckCircle className="w-4 h-4 text-gray-500" />
                <div className="text-sm font-semibold text-gray-700">Resolved Complaints</div>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}