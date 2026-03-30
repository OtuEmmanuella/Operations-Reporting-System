'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { 
  ArrowLeft, Calendar, Download, TrendingUp, Store, User, 
  Package, DollarSign, Hotel, BarChart3, Filter, ChevronDown, ChevronUp
} from 'lucide-react'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import Link from 'next/link'

interface BranchSummary {
  branchName: string
  totalRevenue: number
  roomRevenue: number
  laundryRevenue: number
  foodRevenue: number
  salesRevenue: number
  occupancyRate: number
  totalReports: number
  managers: ManagerSummary[]
}

interface ManagerSummary {
  id: string
  name: string
  email: string
  role: 'manager' | 'front_office_manager'
  totalRevenue: number
  reportsSubmitted: number
  
  // For Store Managers
  topSellingItems?: ItemSale[]
  totalItemsSold?: number
  salesBreakdown?: {
    cash: number
    card: number
    transfer: number
  }
  
  // For Front Office Managers
  avgOccupancy?: number
  totalRoomNights?: number
  revenueBreakdown?: {
    room: number
    laundry: number
    food: number
    other: number
  }
}

interface ItemSale {
  itemName: string
  totalQuantity: number
  totalRevenue: number
  frequency: number // how many days it appeared
}

export default function MonthlySummariesPage() {
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(new Date())
  const [branchSummaries, setbranchSummaries] = useState<BranchSummary[]>([])
  const [expandedBranch, setExpandedBranch] = useState<string | null>(null)
  const [expandedManager, setExpandedManager] = useState<string | null>(null)

  useEffect(() => {
    loadMonthlySummaries()
  }, [selectedMonth])

  const loadMonthlySummaries = async () => {
    setLoading(true)
    try {
      const startDate = format(startOfMonth(selectedMonth), 'yyyy-MM-dd')
      const endDate = format(endOfMonth(selectedMonth), 'yyyy-MM-dd')

      console.log('📅 Loading summaries for', format(selectedMonth, 'MMMM yyyy'))

      // Load all managers
      const { data: managers } = await supabase
        .from('users')
        .select('*')
        .in('role', ['manager', 'front_office_manager'])
        .order('full_name')

      if (!managers) {
        setLoading(false)
        return
      }

      // Load all approved reports for the month
      const [stockReports, revenueReports, occupancyReports, stockItems] = await Promise.all([
        supabase
          .from('stock_inventory_reports')
          .select('*')
          .gte('report_date', startDate)
          .lte('report_date', endDate)
          .eq('status', 'approved'),
        supabase
          .from('revenue_reports')
          .select('*')
          .gte('report_date', startDate)
          .lte('report_date', endDate)
          .eq('status', 'approved'),
        supabase
          .from('occupancy_reports')
          .select('*')
          .gte('report_date', startDate)
          .lte('report_date', endDate)
          .eq('status', 'approved'),
        supabase
          .from('stock_inventory_items')
          .select('*, stock_inventory_reports!inner(report_date, manager_id, status)')
          .eq('item_section', 'sales')
          .gte('stock_inventory_reports.report_date', startDate)
          .lte('stock_inventory_reports.report_date', endDate)
          .eq('stock_inventory_reports.status', 'approved')
      ])

      console.log('📊 Stock reports:', stockReports.data?.length || 0)
      console.log('📊 Revenue reports:', revenueReports.data?.length || 0)
      console.log('📊 Occupancy reports:', occupancyReports.data?.length || 0)
      console.log('📊 Sales items:', stockItems.data?.length || 0)

      // Group managers by branch (assuming branch field exists, or use email domain)
      const branchGroups: Record<string, typeof managers> = {}
      
      managers.forEach(manager => {
        // Extract branch from email (e.g., john@luxury.com -> Luxury)
        const branch = manager.email.split('@')[1]?.split('.')[0] || 'Unknown'
        const branchName = branch.charAt(0).toUpperCase() + branch.slice(1)
        
        if (!branchGroups[branchName]) {
          branchGroups[branchName] = []
        }
        branchGroups[branchName].push(manager)
      })

      // Calculate summaries for each branch
      const summaries: BranchSummary[] = []

      for (const [branchName, branchManagers] of Object.entries(branchGroups)) {
        const managerSummaries: ManagerSummary[] = []
        let branchTotalRevenue = 0
        let branchRoomRevenue = 0
        let branchLaundryRevenue = 0
        let branchFoodRevenue = 0
        let branchSalesRevenue = 0
        let branchTotalReports = 0

        for (const manager of branchManagers) {
          if (manager.role === 'manager') {
            // Store Manager
            const managerStockReports = (stockReports.data || []).filter(
              (r: any) => r.manager_id === manager.id
            )
            
            const totalRevenue = managerStockReports.reduce(
              (sum: number, r: any) => sum + (r.cash_payments || 0) + (r.card_payments || 0) + (r.transfer_payments || 0),
              0
            )

            const salesBreakdown = {
              cash: managerStockReports.reduce((sum: number, r: any) => sum + (r.cash_payments || 0), 0),
              card: managerStockReports.reduce((sum: number, r: any) => sum + (r.card_payments || 0), 0),
              transfer: managerStockReports.reduce((sum: number, r: any) => sum + (r.transfer_payments || 0), 0),
            }

            // Calculate top selling items
            const managerItems = (stockItems.data || []).filter(
              (item: any) => item.stock_inventory_reports.manager_id === manager.id
            )

            const itemsMap: Record<string, { quantity: number; revenue: number; frequency: number }> = {}
            managerItems.forEach((item: any) => {
              const itemName = item.item_name
              if (!itemsMap[itemName]) {
                itemsMap[itemName] = { quantity: 0, revenue: 0, frequency: 0 }
              }
              itemsMap[itemName].quantity += item.quantity || 0
              itemsMap[itemName].revenue += (item.quantity || 0) * (item.unit_price || 0)
              itemsMap[itemName].frequency += 1
            })

            const topSellingItems: ItemSale[] = Object.entries(itemsMap)
              .map(([itemName, data]) => ({
                itemName,
                totalQuantity: data.quantity,
                totalRevenue: data.revenue,
                frequency: data.frequency,
              }))
              .sort((a, b) => b.totalRevenue - a.totalRevenue)
              .slice(0, 10)

            const totalItemsSold = Object.values(itemsMap).reduce(
              (sum, item) => sum + item.quantity,
              0
            )

            managerSummaries.push({
              id: manager.id,
              name: manager.full_name,
              email: manager.email,
              role: manager.role,
              totalRevenue,
              reportsSubmitted: managerStockReports.length,
              topSellingItems,
              totalItemsSold,
              salesBreakdown,
            })

            branchTotalRevenue += totalRevenue
            branchSalesRevenue += totalRevenue
            branchTotalReports += managerStockReports.length

          } else {
            // Front Office Manager
            const managerRevenueReports = (revenueReports.data || []).filter(
              (r: any) => r.manager_id === manager.id
            )
            const managerOccupancyReports = (occupancyReports.data || []).filter(
              (r: any) => r.manager_id === manager.id
            )

            const totalRevenue = managerRevenueReports.reduce(
              (sum: number, r: any) => sum + (r.total_revenue || 0),
              0
            )

            const revenueBreakdown = {
              room: managerRevenueReports.reduce((sum: number, r: any) => sum + (r.room_revenue || 0), 0),
              laundry: managerRevenueReports.reduce((sum: number, r: any) => sum + (r.laundry_revenue || 0), 0),
              food: managerRevenueReports.reduce((sum: number, r: any) => sum + (r.food_revenue || 0), 0),
              other: managerRevenueReports.reduce((sum: number, r: any) => sum + (r.other_revenue || 0), 0),
            }

            const avgOccupancy = managerOccupancyReports.length > 0
              ? managerOccupancyReports.reduce((sum: number, r: any) => sum + (r.occupancy_percentage || 0), 0) / managerOccupancyReports.length
              : 0

            const totalRoomNights = managerOccupancyReports.reduce(
              (sum: number, r: any) => sum + (r.occupied_rooms || 0),
              0
            )

            managerSummaries.push({
              id: manager.id,
              name: manager.full_name,
              email: manager.email,
              role: manager.role,
              totalRevenue,
              reportsSubmitted: managerRevenueReports.length,
              avgOccupancy,
              totalRoomNights,
              revenueBreakdown,
            })

            branchTotalRevenue += totalRevenue
            branchRoomRevenue += revenueBreakdown.room
            branchLaundryRevenue += revenueBreakdown.laundry
            branchFoodRevenue += revenueBreakdown.food
            branchTotalReports += managerRevenueReports.length
          }
        }

        const branchOccupancyReports = (occupancyReports.data || []).filter((r: any) =>
          branchManagers.some(m => m.id === r.manager_id)
        )
        const avgOccupancy = branchOccupancyReports.length > 0
          ? branchOccupancyReports.reduce((sum: number, r: any) => sum + (r.occupancy_percentage || 0), 0) / branchOccupancyReports.length
          : 0

        summaries.push({
          branchName,
          totalRevenue: branchTotalRevenue,
          roomRevenue: branchRoomRevenue,
          laundryRevenue: branchLaundryRevenue,
          foodRevenue: branchFoodRevenue,
          salesRevenue: branchSalesRevenue,
          occupancyRate: avgOccupancy,
          totalReports: branchTotalReports,
          managers: managerSummaries,
        })
      }

      summaries.sort((a, b) => b.totalRevenue - a.totalRevenue)
      setbranchSummaries(summaries)

    } catch (error) {
      console.error('Error loading monthly summaries:', error)
    } finally {
      setLoading(false)
    }
  }

  const handlePreviousMonth = () => {
    setSelectedMonth(subMonths(selectedMonth, 1))
  }

  const handleNextMonth = () => {
    setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1))
  }

  const exportToCSV = (branchName: string) => {
    const branch = branchSummaries.find(b => b.branchName === branchName)
    if (!branch) return

    let csv = `Monthly Summary - ${branchName} - ${format(selectedMonth, 'MMMM yyyy')}\n\n`
    csv += `Branch Total Revenue,₦${branch.totalRevenue.toLocaleString()}\n`
    csv += `Total Reports,${branch.totalReports}\n`
    csv += `Avg Occupancy,${branch.occupancyRate.toFixed(1)}%\n\n`

    branch.managers.forEach(manager => {
      csv += `\n${manager.name},${manager.role === 'manager' ? 'Manager' : 'Front Office Manager'}\n`
      csv += `Revenue,₦${manager.totalRevenue.toLocaleString()}\n`
      csv += `Reports Submitted,${manager.reportsSubmitted}\n`

      if (manager.role === 'manager' && manager.topSellingItems) {
        csv += `\nTop Selling Items:\n`
        csv += `Item,Quantity,Revenue\n`
        manager.topSellingItems.forEach(item => {
          csv += `${item.itemName},${item.totalQuantity},₦${item.totalRevenue.toLocaleString()}\n`
        })
      }
    })

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${branchName}-${format(selectedMonth, 'yyyy-MM')}.csv`
    a.click()
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-lg text-gray-600">Loading monthly summaries...</div>
        </div>
      </div>
    )
  }

  const totalRevenue = branchSummaries.reduce((sum, b) => sum + b.totalRevenue, 0)
  const avgOccupancy = branchSummaries.length > 0
    ? branchSummaries.reduce((sum, b) => sum + b.occupancyRate, 0) / branchSummaries.length
    : 0

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link href="/bdm/analytics" className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-4 text-sm">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Analytics
        </Link>
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Monthly Summaries</h1>
            <p className="text-gray-600">Branch and manager performance summaries</p>
          </div>

          {/* Month Selector */}
          <div className="flex items-center space-x-4">
            <button
              onClick={handlePreviousMonth}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              ← Previous
            </button>
            <div className="px-6 py-2 bg-primary text-white rounded-lg font-semibold">
              {format(selectedMonth, 'MMMM yyyy')}
            </div>
            <button
              onClick={handleNextMonth}
              disabled={selectedMonth >= new Date()}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          </div>
        </div>
      </div>

      {/* Overall Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="card bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <div className="text-sm text-gray-600 mb-1">Total Revenue (All Branches)</div>
          <div className="text-3xl font-bold text-gray-900">
            ₦{totalRevenue.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
          </div>
          <div className="text-xs text-gray-500 mt-1">{format(selectedMonth, 'MMMM yyyy')}</div>
        </div>

        <div className="card">
          <div className="text-sm text-gray-600 mb-1">Active Branches</div>
          <div className="text-3xl font-bold text-gray-900">{branchSummaries.length}</div>
          <div className="text-xs text-gray-500 mt-1">with submitted reports</div>
        </div>

        <div className="card">
          <div className="text-sm text-gray-600 mb-1">Average Occupancy</div>
          <div className="text-3xl font-bold text-gray-900">{avgOccupancy.toFixed(1)}%</div>
          <div className="text-xs text-gray-500 mt-1">across all branches</div>
        </div>
      </div>

      {/* Branch Summaries */}
      <div className="space-y-6">
        {branchSummaries.map((branch, index) => (
          <div key={index} className="card border-2 border-gray-200">
            {/* Branch Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center">
                  <Store className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{branch.branchName}</h2>
                  <p className="text-sm text-gray-600">{branch.managers.length} managers</p>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <button
                  onClick={() => exportToCSV(branch.branchName)}
                  className="btn-secondary flex items-center space-x-2"
                >
                  <Download className="w-4 h-4" />
                  <span>Export CSV</span>
                </button>
                <button
                  onClick={() => setExpandedBranch(expandedBranch === branch.branchName ? null : branch.branchName)}
                  className="btn-primary flex items-center space-x-2"
                >
                  <span>{expandedBranch === branch.branchName ? 'Collapse' : 'View Details'}</span>
                  {expandedBranch === branch.branchName ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Branch Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
              <div>
                <div className="text-xs text-gray-500">Total Revenue</div>
                <div className="text-lg font-bold text-gray-900">
                  ₦{branch.totalRevenue.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Room Revenue</div>
                <div className="text-lg font-bold text-green-600">
                  ₦{branch.roomRevenue.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Sales Revenue</div>
                <div className="text-lg font-bold text-blue-600">
                  ₦{branch.salesRevenue.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Avg Occupancy</div>
                <div className="text-lg font-bold text-purple-600">{branch.occupancyRate.toFixed(1)}%</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Total Reports</div>
                <div className="text-lg font-bold text-gray-900">{branch.totalReports}</div>
              </div>
            </div>

            {/* Manager Details */}
            {expandedBranch === branch.branchName && (
              <div className="space-y-4 border-t border-gray-200 pt-4">
                {branch.managers.map(manager => (
                  <div key={manager.id} className="p-4 bg-white rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                          <User className="w-5 h-5 text-gray-600" />
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-900">{manager.name}</h3>
                          <p className="text-sm text-gray-500">
                            {manager.role === 'manager' ? 'Manager' : 'Front Office Manager'}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => setExpandedManager(expandedManager === manager.id ? null : manager.id)}
                        className="text-sm text-primary hover:text-primary-dark flex items-center space-x-1"
                      >
                        <span>{expandedManager === manager.id ? 'Hide' : 'Show'} Details</span>
                        {expandedManager === manager.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-4 mb-3">
                      <div className="text-center p-2 bg-green-50 rounded">
                        <div className="text-xs text-gray-600">Revenue</div>
                        <div className="text-sm font-bold text-green-600">
                          ₦{manager.totalRevenue.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                        </div>
                      </div>
                      <div className="text-center p-2 bg-blue-50 rounded">
                        <div className="text-xs text-gray-600">Reports</div>
                        <div className="text-sm font-bold text-blue-600">{manager.reportsSubmitted}</div>
                      </div>
                      {manager.role === 'manager' ? (
                        <div className="text-center p-2 bg-purple-50 rounded">
                          <div className="text-xs text-gray-600">Items Sold</div>
                          <div className="text-sm font-bold text-purple-600">{manager.totalItemsSold}</div>
                        </div>
                      ) : (
                        <div className="text-center p-2 bg-purple-50 rounded">
                          <div className="text-xs text-gray-600">Avg Occupancy</div>
                          <div className="text-sm font-bold text-purple-600">{manager.avgOccupancy?.toFixed(1)}%</div>
                        </div>
                      )}
                    </div>

                    {/* Expanded Manager Details */}
                    {expandedManager === manager.id && (
                      <div className="pt-3 border-t border-gray-100">
                        {manager.role === 'manager' ? (
                          <>
                            {/* Store Manager Details */}
                            <div className="mb-4">
                              <h4 className="font-semibold text-gray-700 mb-2">Payment Breakdown</h4>
                              <div className="grid grid-cols-3 gap-3">
                                <div className="p-2 bg-gray-50 rounded">
                                  <div className="text-xs text-gray-500">Cash</div>
                                  <div className="text-sm font-bold text-gray-900">
                                    ₦{manager.salesBreakdown?.cash.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                                  </div>
                                </div>
                                <div className="p-2 bg-gray-50 rounded">
                                  <div className="text-xs text-gray-500">Card</div>
                                  <div className="text-sm font-bold text-gray-900">
                                    ₦{manager.salesBreakdown?.card.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                                  </div>
                                </div>
                                <div className="p-2 bg-gray-50 rounded">
                                  <div className="text-xs text-gray-500">Transfer</div>
                                  <div className="text-sm font-bold text-gray-900">
                                    ₦{manager.salesBreakdown?.transfer.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div>
                              <h4 className="font-semibold text-gray-700 mb-2">Top 10 Selling Items</h4>
                              <div className="space-y-2">
                                {manager.topSellingItems?.map((item, idx) => (
                                  <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                    <div className="flex-1">
                                      <div className="font-medium text-gray-900">{item.itemName}</div>
                                      <div className="text-xs text-gray-500">
                                        Sold {item.frequency} {item.frequency === 1 ? 'day' : 'days'}
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <div className="font-bold text-gray-900">{item.totalQuantity} units</div>
                                      <div className="text-xs text-green-600">
                                        ₦{item.totalRevenue.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </>
                        ) : (
                          <>
                            {/* Front Office Manager Details */}
                            <div className="mb-4">
                              <h4 className="font-semibold text-gray-700 mb-2">Revenue Breakdown</h4>
                              <div className="grid grid-cols-2 gap-3">
                                <div className="p-2 bg-gray-50 rounded">
                                  <div className="text-xs text-gray-500">Room</div>
                                  <div className="text-sm font-bold text-gray-900">
                                    ₦{manager.revenueBreakdown?.room.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                                  </div>
                                </div>
                                <div className="p-2 bg-gray-50 rounded">
                                  <div className="text-xs text-gray-500">Laundry</div>
                                  <div className="text-sm font-bold text-gray-900">
                                    ₦{manager.revenueBreakdown?.laundry.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                                  </div>
                                </div>
                                <div className="p-2 bg-gray-50 rounded">
                                  <div className="text-xs text-gray-500">Food & Beverage</div>
                                  <div className="text-sm font-bold text-gray-900">
                                    ₦{manager.revenueBreakdown?.food.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                                  </div>
                                </div>
                                <div className="p-2 bg-gray-50 rounded">
                                  <div className="text-xs text-gray-500">Other Services</div>
                                  <div className="text-sm font-bold text-gray-900">
                                    ₦{manager.revenueBreakdown?.other.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div>
                              <h4 className="font-semibold text-gray-700 mb-2">Occupancy Stats</h4>
                              <div className="grid grid-cols-2 gap-3">
                                <div className="p-3 bg-blue-50 rounded">
                                  <div className="text-xs text-gray-600">Average Occupancy</div>
                                  <div className="text-xl font-bold text-blue-600">
                                    {manager.avgOccupancy?.toFixed(1)}%
                                  </div>
                                </div>
                                <div className="p-3 bg-purple-50 rounded">
                                  <div className="text-xs text-gray-600">Total Room Nights</div>
                                  <div className="text-xl font-bold text-purple-600">
                                    {manager.totalRoomNights}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {branchSummaries.length === 0 && (
          <div className="card text-center py-12">
            <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">No Data Available</h3>
            <p className="text-gray-600">
              No approved reports found for {format(selectedMonth, 'MMMM yyyy')}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}