'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Download, Package, Search, Calendar } from 'lucide-react'
import { format } from 'date-fns'
import Link from 'next/link'

interface ItemSale {
  itemName: string
  totalQuantity: number
  totalRevenue: number
  averagePrice: number
  frequency: number
}

export default function CombinedSalesReportPage() {
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [items, setItems] = useState<ItemSale[]>([])
  const [search, setSearch] = useState('')
  const [selectedBranch, setSelectedBranch] = useState<string>('all')
  const [branches, setBranches] = useState<string[]>([])

  useEffect(() => {
    loadData()
  }, [startDate, endDate, selectedBranch])

  const loadData = async () => {
    if (!startDate || !endDate) return
    
    setLoading(true)
    try {
      console.log('📊 Loading combined sales report:', startDate, 'to', endDate)

      // Get all managers
      const { data: managers } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'manager')

      if (!managers) {
        setLoading(false)
        return
      }

      // Extract unique branches
      const uniqueBranches = [...new Set(managers.map(m => {
        const branch = m.branch || m.email.split('@')[1]?.split('.')[0] || 'Unknown'
        return branch.charAt(0).toUpperCase() + branch.slice(1)
      }))].sort()
      
      setBranches(uniqueBranches)

      // Filter managers by branch if selected
      let filteredManagers = managers
      if (selectedBranch !== 'all') {
        filteredManagers = managers.filter(m => {
          const branch = m.branch || m.email.split('@')[1]?.split('.')[0] || 'Unknown'
          const branchName = branch.charAt(0).toUpperCase() + branch.slice(1)
          return branchName === selectedBranch
        })
      }

      const managerIds = filteredManagers.map(m => m.id)

      // Load all sales items
      const { data: stockItems } = await supabase
        .from('stock_inventory_items')
        .select('*, stock_inventory_reports!inner(report_date, manager_id, status)')
        .eq('item_section', 'sales')
        .in('stock_inventory_reports.manager_id', managerIds)
        .gte('stock_inventory_reports.report_date', startDate)
        .lte('stock_inventory_reports.report_date', endDate)
        .eq('stock_inventory_reports.status', 'approved')

      // Aggregate items
      const itemsMap: Record<string, {
        quantity: number
        revenue: number
        frequency: number
        totalPrice: number
        priceCount: number
      }> = {}

      ;(stockItems || []).forEach((item: any) => {
        const itemName = item.item_name
        const quantity = item.quantity || 0
        const unitPrice = item.unit_price || 0
        const revenue = quantity * unitPrice

        if (!itemsMap[itemName]) {
          itemsMap[itemName] = {
            quantity: 0,
            revenue: 0,
            frequency: 0,
            totalPrice: 0,
            priceCount: 0
          }
        }

        itemsMap[itemName].quantity += quantity
        itemsMap[itemName].revenue += revenue
        itemsMap[itemName].frequency += 1
        if (unitPrice > 0) {
          itemsMap[itemName].totalPrice += unitPrice
          itemsMap[itemName].priceCount += 1
        }
      })

      const itemsList: ItemSale[] = Object.entries(itemsMap)
        .map(([itemName, data]) => ({
          itemName,
          totalQuantity: data.quantity,
          totalRevenue: data.revenue,
          averagePrice: data.priceCount > 0 ? data.totalPrice / data.priceCount : 0,
          frequency: data.frequency
        }))
        .sort((a, b) => b.totalRevenue - a.totalRevenue)

      setItems(itemsList)

    } catch (error) {
      console.error('Error loading combined sales:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredItems = items.filter(item =>
    item.itemName.toLowerCase().includes(search.toLowerCase())
  )

  const exportToExcel = () => {
    const branchLabel = selectedBranch === 'all' ? 'All Branches' : selectedBranch
    let csv = `Combined Food & Drinks Sales Report - ${branchLabel}\n`
    csv += `Period: ${format(new Date(startDate), 'MMM dd, yyyy')} - ${format(new Date(endDate), 'MMM dd, yyyy')}\n\n`
    
    csv += `SUMMARY\n`
    csv += `Total Items,${filteredItems.length}\n`
    csv += `Total Quantity Sold,${filteredItems.reduce((sum, i) => sum + i.totalQuantity, 0)}\n`
    csv += `Total Revenue,₦${filteredItems.reduce((sum, i) => sum + i.totalRevenue, 0).toLocaleString()}\n\n`

    csv += `ITEM BREAKDOWN\n`
    csv += `Item Name,Quantity Sold,Average Price,Total Revenue,Days Sold\n`
    filteredItems.forEach(item => {
      csv += `${item.itemName},${item.totalQuantity},₦${item.averagePrice.toLocaleString()},₦${item.totalRevenue.toLocaleString()},${item.frequency}\n`
    })

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `combined-sales-${branchLabel.toLowerCase()}-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
  }

  const totalRevenue = filteredItems.reduce((sum, i) => sum + i.totalRevenue, 0)
  const totalQuantity = filteredItems.reduce((sum, i) => sum + i.totalQuantity, 0)

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-lg text-gray-600">Loading sales data...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <Link href="/bdm/analytics" className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-4 text-sm">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Analytics
        </Link>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Combined Food & Drinks Sales</h1>
            <p className="text-gray-600">All items sold across {selectedBranch === 'all' ? 'all branches' : selectedBranch}</p>
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

      {/* Filters */}
      <div className="card mb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Branch</label>
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="input-field"
            >
              <option value="all">All Branches</option>
              {branches.map(branch => (
                <option key={branch} value={branch}>{branch}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="card bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <div className="text-sm text-gray-600 mb-1">Total Revenue</div>
          <div className="text-2xl font-bold text-gray-900">
            ₦{totalRevenue.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
          </div>
          <div className="text-xs text-gray-500 mt-1">From all items sold</div>
        </div>

        <div className="card">
          <div className="text-sm text-gray-600 mb-1">Total Items Sold</div>
          <div className="text-2xl font-bold text-gray-900">{totalQuantity.toLocaleString()}</div>
          <div className="text-xs text-gray-500 mt-1">Units across all items</div>
        </div>

        <div className="card">
          <div className="text-sm text-gray-600 mb-1">Unique Items</div>
          <div className="text-2xl font-bold text-gray-900">{filteredItems.length}</div>
          <div className="text-xs text-gray-500 mt-1">Different menu items</div>
        </div>
      </div>

      {/* Search */}
      <div className="card mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>
        {search && (
          <p className="text-sm text-gray-500 mt-2">
            Found {filteredItems.length} items
          </p>
        )}
      </div>

      {/* Items Table */}
      <div className="card">
        <div className="flex items-center space-x-2 mb-4">
          <Package className="w-5 h-5 text-orange-600" />
          <h2 className="text-xl font-bold text-gray-900">All Items Sold</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b-2 border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">#</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Item Name</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Qty Sold</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Avg Price</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Total Revenue</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">Days Sold</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredItems.map((item, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-500">{index + 1}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.itemName}</td>
                  <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">{item.totalQuantity.toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-600">
                    ₦{item.averagePrice.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-bold text-green-600">
                    ₦{item.totalRevenue.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-4 py-3 text-sm text-center">
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                      {item.frequency} {item.frequency === 1 ? 'day' : 'days'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-100 border-t-2 border-gray-300">
              <tr>
                <td colSpan={2} className="px-4 py-3 text-sm font-bold text-gray-900">TOTAL</td>
                <td className="px-4 py-3 text-sm text-right font-bold text-gray-900">
                  {totalQuantity.toLocaleString()}
                </td>
                <td className="px-4 py-3"></td>
                <td className="px-4 py-3 text-sm text-right font-bold text-green-600">
                  ₦{totalRevenue.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                </td>
                <td className="px-4 py-3"></td>
              </tr>
            </tfoot>
          </table>
        </div>

        {filteredItems.length === 0 && (
          <div className="text-center py-12">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">No items sold in this period</p>
          </div>
        )}
      </div>
    </div>
  )
}