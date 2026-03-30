'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { 
  ArrowLeft, Store, Download, ChevronRight
} from 'lucide-react'
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns'
import Link from 'next/link'

interface BranchPerformance {
  branchName: string
  totalRevenue: number
  salesRevenue: number
  roomRevenue: number
  laundryRevenue: number
  hallRevenue: number
  avgOccupancy: number
  managersCount: number
  reportsCount: number
  topItem: { name: string; quantity: number; revenue: number } | null
}

type TimeFrame = 'daily' | 'weekly' | 'monthly' | 'custom'

export default function BranchPerformancePage() {
  const [loading, setLoading] = useState(true)
  const [timeframe, setTimeframe] = useState<TimeFrame>('weekly')
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [branches, setBranches] = useState<BranchPerformance[]>([])
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [expandedBranch, setExpandedBranch] = useState<string | null>(null)

  useEffect(() => {
    // For custom range, only load when BOTH dates are selected
    if (timeframe === 'custom' && (!customStart || !customEnd)) {
      return
    }
    loadBranchPerformance()
  }, [timeframe, selectedDate, customStart, customEnd])

  const getDateRange = () => {
    const today = selectedDate
    
    switch (timeframe) {
      case 'daily':
        return {
          start: format(today, 'yyyy-MM-dd'),
          end: format(today, 'yyyy-MM-dd'),
          label: format(today, 'MMMM dd, yyyy')
        }
      case 'weekly':
        const weekStart = startOfWeek(today, { weekStartsOn: 1 })
        const weekEnd = endOfWeek(today, { weekStartsOn: 1 })
        return {
          start: format(weekStart, 'yyyy-MM-dd'),
          end: format(weekEnd, 'yyyy-MM-dd'),
          label: `Week: ${format(weekStart, 'MMM dd')} - ${format(weekEnd, 'MMM dd, yyyy')}`
        }
      case 'monthly':
        return {
          start: format(startOfMonth(today), 'yyyy-MM-dd'),
          end: format(endOfMonth(today), 'yyyy-MM-dd'),
          label: format(today, 'MMMM yyyy')
        }
      case 'custom':
        return {
          start: customStart || format(subDays(today, 7), 'yyyy-MM-dd'),
          end: customEnd || format(today, 'yyyy-MM-dd'),
          label: customStart && customEnd ? `${format(new Date(customStart), 'MMM dd')} - ${format(new Date(customEnd), 'MMM dd, yyyy')}` : 'Select dates'
        }
    }
  }

  const loadBranchPerformance = async () => {
    setLoading(true)
    try {
      const { start, end } = getDateRange()

      console.log('📅 Loading branch performance:', start, 'to', end)

      const { data: managers } = await supabase
        .from('users')
        .select('*')
        .in('role', ['manager', 'front_office_manager'])

      if (!managers) {
        setLoading(false)
        return
      }

      const [stockReports, revenueReports, occupancyReports, stockItems] = await Promise.all([
        supabase
          .from('stock_inventory_reports')
          .select('*')
          .gte('report_date', start)
          .lte('report_date', end)
          .eq('status', 'approved'),
        supabase
          .from('revenue_reports')
          .select('*')
          .gte('report_date', start)
          .lte('report_date', end)
          .eq('status', 'approved'),
        supabase
          .from('occupancy_reports')
          .select('*')
          .gte('report_date', start)
          .lte('report_date', end)
          .eq('status', 'approved'),
        supabase
          .from('stock_inventory_items')
          .select('*, stock_inventory_reports!inner(report_date, manager_id, status)')
          .eq('item_section', 'sales')
          .gte('stock_inventory_reports.report_date', start)
          .lte('stock_inventory_reports.report_date', end)
          .eq('stock_inventory_reports.status', 'approved')
      ])

      const branchGroups: Record<string, typeof managers> = {}
      
      managers.forEach(manager => {
        const branch = manager.branch || manager.email.split('@')[1]?.split('.')[0] || 'Unknown'
        const branchName = branch.charAt(0).toUpperCase() + branch.slice(1)
        
        if (!branchGroups[branchName]) {
          branchGroups[branchName] = []
        }
        branchGroups[branchName].push(manager)
      })

      const performance: BranchPerformance[] = []

      for (const [branchName, branchManagers] of Object.entries(branchGroups)) {
        const managerIds = branchManagers.map(m => m.id)

        const branchStockReports = (stockReports.data || []).filter((r: any) =>
          managerIds.includes(r.manager_id)
        )
        const salesRevenue = branchStockReports.reduce(
          (sum: number, r: any) => sum + (r.cash_payments || 0) + (r.card_payments || 0) + (r.transfer_payments || 0),
          0
        )

        const branchRevenueReports = (revenueReports.data || []).filter((r: any) =>
          managerIds.includes(r.manager_id)
        )
        const roomRevenue = branchRevenueReports.reduce((sum: number, r: any) => sum + (r.room_revenue || 0), 0)
        const laundryRevenue = branchRevenueReports.reduce((sum: number, r: any) => sum + (r.laundry_revenue || 0), 0)
        const hallRevenue = branchRevenueReports.reduce((sum: number, r: any) => sum + (r.other_revenue || 0), 0)

        const totalRevenue = salesRevenue + roomRevenue + laundryRevenue + hallRevenue

        const branchOccupancy = (occupancyReports.data || []).filter((r: any) =>
          managerIds.includes(r.manager_id)
        )
        const avgOccupancy = branchOccupancy.length > 0
          ? branchOccupancy.reduce((sum: number, r: any) => sum + (r.occupancy_percentage || 0), 0) / branchOccupancy.length
          : 0

        const branchItems = (stockItems.data || []).filter((item: any) =>
          managerIds.includes(item.stock_inventory_reports.manager_id)
        )

        const itemsMap: Record<string, { quantity: number; revenue: number }> = {}
        branchItems.forEach((item: any) => {
          const itemName = item.item_name
          if (!itemsMap[itemName]) {
            itemsMap[itemName] = { quantity: 0, revenue: 0 }
          }
          itemsMap[itemName].quantity += item.quantity || 0
          itemsMap[itemName].revenue += (item.quantity || 0) * (item.unit_price || 0)
        })

        const topItemEntry = Object.entries(itemsMap)
          .sort(([, a], [, b]) => b.revenue - a.revenue)[0]
        
        const topItem = topItemEntry
          ? { name: topItemEntry[0], quantity: topItemEntry[1].quantity, revenue: topItemEntry[1].revenue }
          : null

        performance.push({
          branchName,
          totalRevenue,
          salesRevenue,
          roomRevenue,
          laundryRevenue,
          hallRevenue,
          avgOccupancy,
          managersCount: branchManagers.length,
          reportsCount: branchStockReports.length + branchRevenueReports.length,
          topItem,
        })
      }

      performance.sort((a, b) => b.totalRevenue - a.totalRevenue)
      setBranches(performance)

    } catch (error) {
      console.error('Error loading branch performance:', error)
    } finally {
      setLoading(false)
    }
  }

  const exportToExcel = () => {
    const { label } = getDateRange()
    
    let csv = `Branch Performance Report - ${label}\n\n`
    csv += `Branch,Total Revenue,Sales Revenue,Room Revenue,Laundry Revenue,Hall Revenue,Avg Occupancy,Managers,Reports,Top Item\n`

    branches.forEach(branch => {
      csv += `${branch.branchName},`
      csv += `₦${branch.totalRevenue.toLocaleString()},`
      csv += `₦${branch.salesRevenue.toLocaleString()},`
      csv += `₦${branch.roomRevenue.toLocaleString()},`
      csv += `₦${branch.laundryRevenue.toLocaleString()},`
      csv += `₦${branch.hallRevenue.toLocaleString()},`
      csv += `${branch.avgOccupancy.toFixed(1)}%,`
      csv += `${branch.managersCount},`
      csv += `${branch.reportsCount},`
      csv += `${branch.topItem ? `${branch.topItem.name} (${branch.topItem.quantity} units)` : 'N/A'}\n`
    })

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `branch-performance-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-lg text-gray-600">Loading branch performance...</div>
        </div>
      </div>
    )
  }

  const totalRevenue = branches.reduce((sum, b) => sum + b.totalRevenue, 0)
  const { label } = getDateRange()

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <Link href="/bdm/analytics" className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-4 text-sm">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Analytics
        </Link>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Branch Performance</h1>
            <p className="text-gray-600">Compare performance across all branches • {label}</p>
          </div>

          <button
            onClick={exportToExcel}
            className="btn-primary flex items-center space-x-2"
          >
            <Download className="w-4 h-4" />
            <span>Export Excel</span>
          </button>
        </div>
      </div>

      <div className="card mb-8">
        <div className="grid grid-cols-4 gap-3 mb-4">
          {[
            { value: 'daily' as TimeFrame, label: 'Daily' },
            { value: 'weekly' as TimeFrame, label: 'Weekly' },
            { value: 'monthly' as TimeFrame, label: 'Monthly' },
            { value: 'custom' as TimeFrame, label: 'Custom Range' },
          ].map(option => (
            <button
              key={option.value}
              onClick={() => setTimeframe(option.value)}
              className={`px-4 py-3 rounded-lg font-medium transition-colors ${
                timeframe === option.value
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {timeframe === 'custom' ? (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="input-field"
              />
            </div>
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Date</label>
            <input
              type="date"
              value={format(selectedDate, 'yyyy-MM-dd')}
              onChange={(e) => setSelectedDate(new Date(e.target.value))}
              className="input-field max-w-xs"
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="card bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <div className="text-sm text-gray-600 mb-1">Total Revenue</div>
          <div className="text-2xl font-bold text-gray-900">
            ₦{totalRevenue.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
          </div>
          <div className="text-xs text-gray-500 mt-1">All branches combined</div>
        </div>

        <div className="card">
          <div className="text-sm text-gray-600 mb-1">Active Branches</div>
          <div className="text-2xl font-bold text-gray-900">{branches.length}</div>
          <div className="text-xs text-gray-500 mt-1">with submitted reports</div>
        </div>

        <div className="card">
          <div className="text-sm text-gray-600 mb-1">Top Performer</div>
          <div className="text-lg font-bold text-green-600">
            {branches[0]?.branchName || 'N/A'}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            ₦{(branches[0]?.totalRevenue || 0).toLocaleString('en-NG', { maximumFractionDigits: 0 })}
          </div>
        </div>

        <div className="card">
          <div className="text-sm text-gray-600 mb-1">Average Occupancy</div>
          <div className="text-2xl font-bold text-gray-900">
            {branches.length > 0 ? (branches.reduce((sum, b) => sum + b.avgOccupancy, 0) / branches.length).toFixed(1) : '0.0'}%
          </div>
          <div className="text-xs text-gray-500 mt-1">Across all branches</div>
        </div>
      </div>

      <div className="space-y-6">
        {branches.map((branch, index) => (
          <div key={index} className="card border-2 border-gray-200 hover:border-primary transition-colors">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  index === 0 ? 'bg-yellow-100' : index === 1 ? 'bg-gray-100' : index === 2 ? 'bg-orange-100' : 'bg-blue-100'
                }`}>
                  {index === 0 ? (
                    <span className="text-2xl">🥇</span>
                  ) : index === 1 ? (
                    <span className="text-2xl">🥈</span>
                  ) : index === 2 ? (
                    <span className="text-2xl">🥉</span>
                  ) : (
                    <Store className="w-6 h-6 text-blue-600" />
                  )}
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">{branch.branchName}</h3>
                  <p className="text-sm text-gray-600">
                    {branch.managersCount} managers • {branch.reportsCount} reports
                  </p>
                </div>
              </div>

              <Link
                href={`/bdm/analytics/branch-details/${branch.branchName.toLowerCase()}?start=${getDateRange().start}&end=${getDateRange().end}&timeframe=${timeframe}`}
                className="btn-primary flex items-center space-x-2"
              >
                <span>View Details</span>
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <div className="text-xs text-gray-500 mb-1">Total Revenue</div>
                <div className="text-lg font-bold text-gray-900">
                  ₦{branch.totalRevenue.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">Sales (Food/Drinks)</div>
                <div className="text-lg font-bold text-orange-600">
                  ₦{branch.salesRevenue.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">Room Revenue</div>
                <div className="text-lg font-bold text-green-600">
                  ₦{branch.roomRevenue.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">Laundry</div>
                <div className="text-lg font-bold text-blue-600">
                  ₦{branch.laundryRevenue.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">Hall Revenue</div>
                <div className="text-lg font-bold text-purple-600">
                  ₦{branch.hallRevenue.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-blue-50 rounded-lg">
                <div className="text-xs text-gray-600 mb-1">Average Occupancy</div>
                <div className="text-xl font-bold text-blue-600">{branch.avgOccupancy.toFixed(1)}%</div>
              </div>
              <div className="p-3 bg-purple-50 rounded-lg">
                <button
                  onClick={() => setExpandedBranch(expandedBranch === branch.branchName ? null : branch.branchName)}
                  className="w-full text-left flex items-center justify-between"
                >
                  <div>
                    <div className="text-xs text-gray-600 mb-1">Top Selling Item</div>
                    <div className="text-sm font-bold text-purple-900">
                      {branch.topItem ? branch.topItem.name : 'No sales data'}
                    </div>
                  </div>
                  {branch.topItem && (
                    <ChevronRight className={`w-4 h-4 text-purple-600 transition-transform ${expandedBranch === branch.branchName ? 'rotate-90' : ''}`} />
                  )}
                </button>
                
                {expandedBranch === branch.branchName && branch.topItem && (
                  <div className="mt-3 pt-3 border-t border-purple-200">
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-purple-700 font-medium">Quantity Sold:</span>
                        <span className="text-purple-900 font-bold">{branch.topItem.quantity} units</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-purple-700 font-medium">Revenue:</span>
                        <span className="text-purple-900 font-bold">
                          ₦{branch.topItem.revenue.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {branches.length === 0 && (
          <div className="card text-center py-12">
            <Store className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">No Data Available</h3>
            <p className="text-gray-600">
              No approved reports found for the selected time period
            </p>
          </div>
        )}
      </div>
    </div>
  )
}