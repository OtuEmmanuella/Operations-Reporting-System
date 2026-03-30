'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams } from 'next/navigation'
import { ArrowLeft, User, ChevronRight, Download, Calendar } from 'lucide-react'
import { format, subDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns'
import Link from 'next/link'

interface ManagerDetails {
  id: string
  name: string
  email: string
  role: 'manager' | 'front_office_manager'
  totalRevenue: number
  reportsSubmitted: number
  salesRevenue?: number
  cashPayments?: number
  cardPayments?: number
  transferPayments?: number
  topItems?: { name: string; quantity: number; revenue: number }[]
  roomRevenue?: number
  laundryRevenue?: number
  otherRevenue?: number
  avgOccupancy?: number
}

type DateRangeOption = 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'custom'

export default function BranchDetailsPage() {
  const params = useParams()
  const branchName = (params.branch as string).charAt(0).toUpperCase() + (params.branch as string).slice(1)

  const [loading, setLoading] = useState(false)
  const [managers, setManagers] = useState<ManagerDetails[]>([])
  const [dateRangeOption, setDateRangeOption] = useState<DateRangeOption>('this_week')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [showCustomDates, setShowCustomDates] = useState(false)

  useEffect(() => {
    updateDateRange('this_week')
  }, [])

  useEffect(() => {
    if (startDate && endDate) {
      loadBranchManagers()
    }
  }, [startDate, endDate])

  const updateDateRange = (option: DateRangeOption) => {
    const today = new Date()
    let start: Date
    let end: Date

    switch (option) {
      case 'today':
        start = today; end = today; break
      case 'yesterday':
        start = subDays(today, 1); end = subDays(today, 1); break
      case 'this_week':
        start = startOfWeek(today, { weekStartsOn: 1 })
        end = endOfWeek(today, { weekStartsOn: 1 })
        break
      case 'last_week': {
        const lastWeek = subDays(today, 7)
        start = startOfWeek(lastWeek, { weekStartsOn: 1 })
        end = endOfWeek(lastWeek, { weekStartsOn: 1 })
        break
      }
      case 'this_month':
        start = startOfMonth(today); end = endOfMonth(today); break
      case 'last_month': {
        const lastMonth = subDays(startOfMonth(today), 1)
        start = startOfMonth(lastMonth); end = endOfMonth(lastMonth)
        break
      }
      case 'custom':
        setShowCustomDates(true)
        setDateRangeOption('custom')
        return
      default:
        start = startOfWeek(today, { weekStartsOn: 1 })
        end = endOfWeek(today, { weekStartsOn: 1 })
    }

    setStartDate(format(start, 'yyyy-MM-dd'))
    setEndDate(format(end, 'yyyy-MM-dd'))
    setShowCustomDates(false)
    setDateRangeOption(option)
  }

  const handleCustomDateApply = () => {
    if (startDate && endDate) {
      setDateRangeOption('custom')
      setShowCustomDates(false)
      loadBranchManagers()
    }
  }

  const loadBranchManagers = async () => {
    setLoading(true)
    try {
      const { data: allManagers } = await supabase
        .from('users')
        .select('*')
        .in('role', ['manager', 'front_office_manager'])

      if (!allManagers) { setLoading(false); return }

      const branchManagers = allManagers.filter((m: any) => {
        const managerBranch = m.branch || m.email?.split('@')[1]?.split('.')[0] || 'Unknown'
        const managerBranchName = managerBranch.charAt(0).toUpperCase() + managerBranch.slice(1)
        return managerBranchName === branchName
      })

      const [stockReports, revenueReports, occupancyReports, stockItems] = await Promise.all([
        supabase.from('stock_inventory_reports').select('*')
          .gte('report_date', startDate).lte('report_date', endDate).eq('status', 'approved'),
        supabase.from('revenue_reports').select('*')
          .gte('report_date', startDate).lte('report_date', endDate).eq('status', 'approved'),
        supabase.from('occupancy_reports').select('*')
          .gte('report_date', startDate).lte('report_date', endDate).eq('status', 'approved'),
        supabase.from('stock_inventory_items')
          .select('*, stock_inventory_reports!inner(report_date, manager_id, status)')
          .eq('item_section', 'sales')
          .gte('stock_inventory_reports.report_date', startDate)
          .lte('stock_inventory_reports.report_date', endDate)
          .eq('stock_inventory_reports.status', 'approved'),
      ])

      const managerDetails: ManagerDetails[] = []

      for (const manager of branchManagers) {
        if ((manager as any).role === 'manager') {
          const managerReports = (stockReports.data || []).filter((r: any) => r.manager_id === (manager as any).id)
          const salesRevenue = managerReports.reduce(
            (sum: number, r: any) => sum + (r.cash_payments || 0) + (r.card_payments || 0) + (r.transfer_payments || 0), 0
          )
          const cashPayments = managerReports.reduce((sum: number, r: any) => sum + (r.cash_payments || 0), 0)
          const cardPayments = managerReports.reduce((sum: number, r: any) => sum + (r.card_payments || 0), 0)
          const transferPayments = managerReports.reduce((sum: number, r: any) => sum + (r.transfer_payments || 0), 0)

          const managerItems = (stockItems.data || []).filter(
            (item: any) => item.stock_inventory_reports.manager_id === (manager as any).id
          )
          const itemsMap: Record<string, { quantity: number; revenue: number }> = {}
          managerItems.forEach((item: any) => {
            if (!itemsMap[item.item_name]) itemsMap[item.item_name] = { quantity: 0, revenue: 0 }
            itemsMap[item.item_name].quantity += item.quantity || 0
            itemsMap[item.item_name].revenue += (item.quantity || 0) * (item.unit_price || 0)
          })
          const topItems = Object.entries(itemsMap)
            .map(([name, data]) => ({ name, ...data }))
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 3)

          managerDetails.push({
            id: (manager as any).id,
            name: (manager as any).full_name,
            email: (manager as any).email,
            role: (manager as any).role,
            totalRevenue: salesRevenue,
            reportsSubmitted: managerReports.length,
            salesRevenue, cashPayments, cardPayments, transferPayments, topItems,
          })
        } else {
          const managerReports = (revenueReports.data || []).filter((r: any) => r.manager_id === (manager as any).id)
          const managerOccupancy = (occupancyReports.data || []).filter((r: any) => r.manager_id === (manager as any).id)
          const roomRevenue = managerReports.reduce((sum: number, r: any) => sum + (r.room_revenue || 0), 0)
          const laundryRevenue = managerReports.reduce((sum: number, r: any) => sum + (r.laundry_revenue || 0), 0)
          const otherRevenue = managerReports.reduce((sum: number, r: any) => sum + (r.other_services_revenue || 0), 0)
          const avgOccupancy = managerOccupancy.length > 0
            ? managerOccupancy.reduce((sum: number, r: any) => sum + (r.occupancy_percentage || 0), 0) / managerOccupancy.length
            : 0

          managerDetails.push({
            id: (manager as any).id,
            name: (manager as any).full_name,
            email: (manager as any).email,
            role: (manager as any).role,
            totalRevenue: roomRevenue + laundryRevenue + otherRevenue,
            reportsSubmitted: managerReports.length,
            roomRevenue, laundryRevenue, otherRevenue, avgOccupancy,
          })
        }
      }

      managerDetails.sort((a, b) => b.totalRevenue - a.totalRevenue)
      setManagers(managerDetails)
    } catch (error) {
      console.error('Error loading branch managers:', error)
    } finally {
      setLoading(false)
    }
  }

  const exportToExcel = () => {
    if (!startDate || !endDate) return
    let csv = `${branchName} Branch - Manager Details\n`
    csv += `Period: ${format(new Date(startDate), 'MMM dd, yyyy')} - ${format(new Date(endDate), 'MMM dd, yyyy')}\n\n`
    csv += `Manager,Role,Total Revenue,Reports Submitted\n`
    managers.forEach(m => {
      csv += `${m.name},${m.role === 'manager' ? 'Manager' : 'Front Office Manager'},₦${m.totalRevenue.toLocaleString()},${m.reportsSubmitted}\n`
    })
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${branchName}-managers-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
  }

  const totalRevenue = managers.reduce((sum, m) => sum + m.totalRevenue, 0)

  // Safe formatted date range label for display
  const dateRangeLabel = startDate && endDate
    ? `${format(new Date(startDate), 'MMM dd, yyyy')} - ${format(new Date(endDate), 'MMM dd, yyyy')}`
    : 'Loading...'

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <Link
          href="/bdm/analytics/branch-performance"
          className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-4 text-sm"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Branch Performance
        </Link>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{branchName} Branch</h1>
            <p className="text-gray-600">Manager performance • {dateRangeLabel}</p>
          </div>
          <button onClick={exportToExcel} className="btn-primary flex items-center space-x-2">
            <Download className="w-4 h-4" />
            <span>Export Excel</span>
          </button>
        </div>

        {/* Date Range Selector */}
        <div className="card bg-blue-50 border-blue-200">
          <div className="flex items-center space-x-2 mb-3">
            <Calendar className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-blue-900">Date Range</h3>
          </div>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {([
              { value: 'today', label: 'Today' },
              { value: 'yesterday', label: 'Yesterday' },
              { value: 'this_week', label: 'This Week' },
              { value: 'last_week', label: 'Last Week' },
              { value: 'this_month', label: 'This Month' },
              { value: 'last_month', label: 'Last Month' },
              { value: 'custom', label: 'Custom Range' },
            ] as { value: DateRangeOption; label: string }[]).map(option => (
              <button
                key={option.value}
                onClick={() => updateDateRange(option.value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  dateRangeOption === option.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-blue-100'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {showCustomDates && (
            <div className="flex items-center gap-3 p-3 bg-white rounded-lg">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="input-field text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="input-field text-sm"
                />
              </div>
              <button
                onClick={handleCustomDateApply}
                className="mt-5 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
              >
                Apply
              </button>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <div className="text-gray-600">Loading managers...</div>
          </div>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="card bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
              <div className="text-sm text-gray-600 mb-1">Total Revenue</div>
              <div className="text-2xl font-bold text-gray-900">
                ₦{totalRevenue.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
              </div>
              <div className="text-xs text-gray-500 mt-1">All managers combined</div>
            </div>
            <div className="card">
              <div className="text-sm text-gray-600 mb-1">Total Managers</div>
              <div className="text-2xl font-bold text-gray-900">{managers.length}</div>
              <div className="text-xs text-gray-500 mt-1">
                {managers.filter(m => m.role === 'manager').length} Managers •{' '}
                {managers.filter(m => m.role === 'front_office_manager').length} FOMs
              </div>
            </div>
            <div className="card">
              <div className="text-sm text-gray-600 mb-1">Top Performer</div>
              <div className="text-lg font-bold text-green-600">{managers[0]?.name || 'N/A'}</div>
              <div className="text-xs text-gray-500 mt-1">
                ₦{(managers[0]?.totalRevenue || 0).toLocaleString('en-NG', { maximumFractionDigits: 0 })}
              </div>
            </div>
          </div>

          {/* Manager Cards */}
          <div className="space-y-4">
            {managers.map((manager) => (
              <div key={manager.id} className="card border-2 border-gray-200 hover:border-primary transition-colors">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                      <User className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">{manager.name}</h3>
                      <p className="text-sm text-gray-600">
                        {manager.role === 'manager' ? 'Manager' : 'Front Office Manager'} • {manager.reportsSubmitted} reports
                      </p>
                    </div>
                  </div>
                  <Link
                    href={
                      manager.role === 'manager'
                        ? `/bdm/analytics/manager-sales-detail/${manager.id}?start=${startDate}&end=${endDate}&name=${encodeURIComponent(manager.name)}`
                        : `/bdm/analytics/manager-revenue-detail/${manager.id}?start=${startDate}&end=${endDate}&name=${encodeURIComponent(manager.name)}`
                    }
                    className="btn-primary flex items-center space-x-2"
                  >
                    <span>View Detailed Report</span>
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>

                {manager.role === 'manager' ? (
                  <>
                    <div className="grid grid-cols-4 gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Total Revenue</div>
                        <div className="text-lg font-bold text-gray-900">
                          ₦{manager.salesRevenue?.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Cash</div>
                        <div className="text-lg font-bold text-green-600">
                          ₦{manager.cashPayments?.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Card</div>
                        <div className="text-lg font-bold text-blue-600">
                          ₦{manager.cardPayments?.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Transfer</div>
                        <div className="text-lg font-bold text-purple-600">
                          ₦{manager.transferPayments?.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                        </div>
                      </div>
                    </div>
                    {manager.topItems && manager.topItems.length > 0 && (
                      <div className="p-3 bg-orange-50 rounded-lg">
                        <div className="text-xs font-semibold text-orange-900 mb-2">Top Selling Items:</div>
                        <div className="flex flex-wrap gap-2">
                          {manager.topItems.map((item, idx) => (
                            <span key={idx} className="px-3 py-1 bg-white rounded-full text-xs font-medium text-gray-700">
                              {item.name}: {item.quantity} units
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="grid grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Room Revenue</div>
                      <div className="text-lg font-bold text-green-600">
                        ₦{manager.roomRevenue?.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Laundry</div>
                      <div className="text-lg font-bold text-blue-600">
                        ₦{manager.laundryRevenue?.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Other Revenue</div>
                      <div className="text-lg font-bold text-purple-600">
                        ₦{manager.otherRevenue?.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Avg Occupancy</div>
                      <div className="text-lg font-bold text-orange-600">
                        {manager.avgOccupancy?.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {managers.length === 0 && (
              <div className="card text-center py-12">
                <User className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-900 mb-2">No Managers Found</h3>
                <p className="text-gray-600">
                  No managers found for {branchName} branch in the selected date range
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}