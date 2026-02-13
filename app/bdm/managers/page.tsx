'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Users, User, Mail, Briefcase, Building2, Hotel } from 'lucide-react'

interface Manager {
  id: string
  full_name: string
  email: string
  role: 'manager' | 'front_office_manager'
  position: string | null
  department: string | null
  created_at: string
}

interface ManagerStats {
  total_reports: number
  pending: number
  approved: number
  rejected: number
}

interface ReportStatus {
  status: 'pending' | 'approved' | 'rejected'
}

export default function ManagersPage() {
  const [loading, setLoading] = useState(true)
  const [managers, setManagers] = useState<Manager[]>([])
  const [stats, setStats] = useState<Map<string, ManagerStats>>(new Map())

  useEffect(() => {
    loadManagers()
  }, [])

  const loadManagers = async () => {
    try {
      // Get both manager and front_office_manager roles
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email, role, position, department, created_at')
        .in('role', ['manager', 'front_office_manager'])
        .order('full_name')

      if (error) throw error

      const managersData = (data || []) as Manager[]
      setManagers(managersData)

      // Load stats for each manager
      if (managersData.length > 0) {
        const statsMap = new Map<string, ManagerStats>()
        
        for (const manager of managersData) {
          let allReports: ReportStatus[] = []

          if (manager.role === 'manager') {
            // Regular manager - stock, sales, expense reports
            const [stockData, salesData, expenseData] = await Promise.all([
              supabase.from('stock_reports').select('status').eq('manager_id', manager.id),
              supabase.from('sales_reports').select('status').eq('manager_id', manager.id),
              supabase.from('expense_reports').select('status').eq('manager_id', manager.id),
            ])

            allReports = [
              ...(stockData.data || []) as ReportStatus[],
              ...(salesData.data || []) as ReportStatus[],
              ...(expenseData.data || []) as ReportStatus[],
            ]
          } else if (manager.role === 'front_office_manager') {
            // Front office manager - occupancy, guest_activity, revenue, complaint reports
            const [occupancyData, guestData, revenueData, complaintData] = await Promise.all([
              supabase.from('occupancy_reports').select('status').eq('manager_id', manager.id),
              supabase.from('guest_activity_reports').select('status').eq('manager_id', manager.id),
              supabase.from('revenue_reports').select('status').eq('manager_id', manager.id),
              supabase.from('complaint_reports').select('status').eq('manager_id', manager.id),
            ])

            allReports = [
              ...(occupancyData.data || []) as ReportStatus[],
              ...(guestData.data || []) as ReportStatus[],
              ...(revenueData.data || []) as ReportStatus[],
              ...(complaintData.data || []) as ReportStatus[],
            ]
          }

          statsMap.set(manager.id, {
            total_reports: allReports.length,
            pending: allReports.filter(r => r.status === 'pending').length,
            approved: allReports.filter(r => r.status === 'approved').length,
            rejected: allReports.filter(r => r.status === 'rejected').length,
          })
        }

        setStats(statsMap)
      }
    } catch (error) {
      console.error('Error loading managers:', error)
    } finally {
      setLoading(false)
    }
  }

  const getManagerIcon = (role: string) => {
    return role === 'front_office_manager' ? <Hotel className="w-6 h-6 text-primary" /> : <User className="w-6 h-6 text-primary" />
  }

  const getManagerRoleLabel = (role: string) => {
    return role === 'front_office_manager' ? 'Front Office Manager' : 'Manager'
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-lg text-gray-600">Loading managers...</div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Managers</h1>
        <p className="text-gray-600 mt-2">View all managers and their reporting statistics</p>
      </div>

      {/* Summary Card */}
      <div className="card mb-8 bg-primary/5 border-primary/20">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center">
            <Users className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="text-sm text-gray-600">Total Managers</div>
            <div className="text-2xl font-bold text-gray-900">{managers.length}</div>
            <div className="text-xs text-gray-500 mt-1">
              {managers.filter(m => m.role === 'manager').length} Regular • {managers.filter(m => m.role === 'front_office_manager').length} Front Office
            </div>
          </div>
        </div>
      </div>

      {/* Managers Grid */}
      {managers.length === 0 ? (
        <div className="card text-center py-12">
          <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Managers Found</h3>
          <p className="text-gray-600">No managers have been registered yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {managers.map((manager) => {
            const managerStats = stats.get(manager.id) || {
              total_reports: 0,
              pending: 0,
              approved: 0,
              rejected: 0,
            }

            return (
              <div key={manager.id} className="card hover:shadow-lg transition-shadow">
                {/* Manager Header */}
                <div className="flex items-start space-x-4 mb-4 pb-4 border-b border-gray-200">
                  <div className={`w-12 h-12 ${manager.role === 'front_office_manager' ? 'bg-indigo-100' : 'bg-primary/10'} rounded-full flex items-center justify-center flex-shrink-0`}>
                    {getManagerIcon(manager.role)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900 truncate">
                      {manager.full_name}
                    </h3>
                    <div className="flex items-center space-x-2 text-sm text-gray-600 mt-1">
                      <Mail className="w-4 h-4" />
                      <span className="truncate">{manager.email}</span>
                    </div>
                    <div className="mt-1">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        manager.role === 'front_office_manager' 
                          ? 'bg-indigo-100 text-indigo-800' 
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {getManagerRoleLabel(manager.role)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Manager Details */}
                <div className="space-y-2 mb-4">
                  {manager.position && (
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <Briefcase className="w-4 h-4" />
                      <span>{manager.position}</span>
                    </div>
                  )}
                  {manager.department && (
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <Building2 className="w-4 h-4" />
                      <span>{manager.department}</span>
                    </div>
                  )}
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-4 gap-3 pt-4 border-t border-gray-200">
                  <div className="text-center">
                    <div className="text-xs text-gray-600">Total</div>
                    <div className="text-lg font-bold text-gray-900">{managerStats.total_reports}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-600">Pending</div>
                    <div className="text-lg font-bold text-warning">{managerStats.pending}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-600">Approved</div>
                    <div className="text-lg font-bold text-success">{managerStats.approved}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-600">Rejected</div>
                    <div className="text-lg font-bold text-danger">{managerStats.rejected}</div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}