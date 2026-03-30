'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useSearchParams } from 'next/navigation'
import { ArrowLeft, Download, Package, DollarSign, Calendar } from 'lucide-react'
import { format, eachDayOfInterval } from 'date-fns'
import Link from 'next/link'

interface ItemSale {
  itemName: string
  totalQuantity: number
  unitPrice: number
  totalRevenue: number
  frequency: number
  dailyBreakdown: { date: string; quantity: number; revenue: number }[]
}

interface DailyPayments {
  date: string
  cash: number
  card: number
  transfer: number
  total: number
}

export default function ManagerSalesDetailPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  
  const managerId = params.id as string
  const managerName = searchParams.get('name') || 'Manager'
  const start = searchParams.get('start') || ''
  const end = searchParams.get('end') || ''
  
  const [loading, setLoading] = useState(true)
  const [itemsSold, setItemsSold] = useState<ItemSale[]>([])
  const [dailyPayments, setDailyPayments] = useState<DailyPayments[]>([])
  const [totalStats, setTotalStats] = useState({
    totalRevenue: 0,
    totalCash: 0,
    totalCard: 0,
    totalTransfer: 0,
    totalItemsSold: 0,
    uniqueItems: 0
  })

  useEffect(() => {
    loadSalesDetail()
  }, [])

  const loadSalesDetail = async () => {
    setLoading(true)
    try {
      console.log('📊 Loading sales detail for manager:', managerId)

      // Load all stock reports and items for this manager
      const [stockReports, stockItems] = await Promise.all([
        supabase
          .from('stock_inventory_reports')
          .select('*')
          .eq('manager_id', managerId)
          .gte('report_date', start)
          .lte('report_date', end)
          .eq('status', 'approved')
          .order('report_date'),
        supabase
          .from('stock_inventory_items')
          .select('*, stock_inventory_reports!inner(report_date, manager_id, status)')
          .eq('item_section', 'sales')
          .eq('stock_inventory_reports.manager_id', managerId)
          .gte('stock_inventory_reports.report_date', start)
          .lte('stock_inventory_reports.report_date', end)
          .eq('stock_inventory_reports.status', 'approved')
      ])

      // Calculate daily payments
      const payments: DailyPayments[] = (stockReports.data || []).map((r: any) => ({
        date: r.report_date,
        cash: r.cash_payments || 0,
        card: r.card_payments || 0,
        transfer: r.transfer_payments || 0,
        total: (r.cash_payments || 0) + (r.card_payments || 0) + (r.transfer_payments || 0)
      }))

      setDailyPayments(payments)

      // Calculate item sales
      const itemsMap: Record<string, {
        quantity: number
        unitPrice: number
        revenue: number
        frequency: number
        dailyBreakdown: { date: string; quantity: number; revenue: number }[]
      }> = {}

      ;(stockItems.data || []).forEach((item: any) => {
        const itemName = item.item_name
        const date = item.stock_inventory_reports.report_date
        const quantity = item.quantity || 0
        const unitPrice = item.unit_price || 0
        const revenue = quantity * unitPrice

        if (!itemsMap[itemName]) {
          itemsMap[itemName] = {
            quantity: 0,
            unitPrice,
            revenue: 0,
            frequency: 0,
            dailyBreakdown: []
          }
        }

        itemsMap[itemName].quantity += quantity
        itemsMap[itemName].revenue += revenue
        itemsMap[itemName].frequency += 1
        itemsMap[itemName].dailyBreakdown.push({ date, quantity, revenue })
      })

      const items: ItemSale[] = Object.entries(itemsMap)
        .map(([itemName, data]) => ({
          itemName,
          totalQuantity: data.quantity,
          unitPrice: data.unitPrice,
          totalRevenue: data.revenue,
          frequency: data.frequency,
          dailyBreakdown: data.dailyBreakdown
        }))
        .sort((a, b) => b.totalRevenue - a.totalRevenue)

      setItemsSold(items)

      // Calculate totals
      const totalRevenue = payments.reduce((sum, p) => sum + p.total, 0)
      const totalCash = payments.reduce((sum, p) => sum + p.cash, 0)
      const totalCard = payments.reduce((sum, p) => sum + p.card, 0)
      const totalTransfer = payments.reduce((sum, p) => sum + p.transfer, 0)
      const totalItemsSold = items.reduce((sum, i) => sum + i.totalQuantity, 0)

      setTotalStats({
        totalRevenue,
        totalCash,
        totalCard,
        totalTransfer,
        totalItemsSold,
        uniqueItems: items.length
      })

    } catch (error) {
      console.error('Error loading sales detail:', error)
    } finally {
      setLoading(false)
    }
  }

  const exportToExcel = () => {
    let csv = `${managerName} - Detailed Sales Report\n`
    csv += `Period: ${format(new Date(start), 'MMM dd, yyyy')} - ${format(new Date(end), 'MMM dd, yyyy')}\n\n`
    
    csv += `SUMMARY\n`
    csv += `Total Revenue,₦${totalStats.totalRevenue.toLocaleString()}\n`
    csv += `Cash Payments,₦${totalStats.totalCash.toLocaleString()}\n`
    csv += `Card Payments,₦${totalStats.totalCard.toLocaleString()}\n`
    csv += `Transfer Payments,₦${totalStats.totalTransfer.toLocaleString()}\n`
    csv += `Total Items Sold,${totalStats.totalItemsSold}\n`
    csv += `Unique Items,${totalStats.uniqueItems}\n\n`

    csv += `ITEMS SOLD\n`
    csv += `Item Name,Quantity,Unit Price,Total Revenue,Days Sold\n`
    itemsSold.forEach(item => {
      csv += `${item.itemName},${item.totalQuantity},₦${item.unitPrice.toLocaleString()},₦${item.totalRevenue.toLocaleString()},${item.frequency}\n`
    })

    csv += `\nDAILY PAYMENTS\n`
    csv += `Date,Cash,Card,Transfer,Total\n`
    dailyPayments.forEach(p => {
      csv += `${format(new Date(p.date), 'MMM dd, yyyy')},₦${p.cash.toLocaleString()},₦${p.card.toLocaleString()},₦${p.transfer.toLocaleString()},₦${p.total.toLocaleString()}\n`
    })

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${managerName}-sales-detail-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-lg text-gray-600">Loading sales details...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <button
          onClick={() => window.history.back()}
          className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-4 text-sm"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </button>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{managerName}</h1>
            <p className="text-gray-600">
              Detailed Sales Report • {format(new Date(start), 'MMM dd, yyyy')} - {format(new Date(end), 'MMM dd, yyyy')}
            </p>
          </div>

          <button
            onClick={exportToExcel}
            className="btn-primary flex items-center space-x-2"
          >
            <Download className="w-4 h-4" />
            <span>Export to Excel</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
        <div className="card bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <div className="text-xs text-gray-600 mb-1">Total Revenue</div>
          <div className="text-xl font-bold text-gray-900">
            ₦{totalStats.totalRevenue.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
          </div>
        </div>
        <div className="card">
          <div className="text-xs text-gray-600 mb-1">Cash</div>
          <div className="text-xl font-bold text-green-600">
            ₦{totalStats.totalCash.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
          </div>
        </div>
        <div className="card">
          <div className="text-xs text-gray-600 mb-1">Card</div>
          <div className="text-xl font-bold text-blue-600">
            ₦{totalStats.totalCard.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
          </div>
        </div>
        <div className="card">
          <div className="text-xs text-gray-600 mb-1">Transfer</div>
          <div className="text-xl font-bold text-purple-600">
            ₦{totalStats.totalTransfer.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
          </div>
        </div>
        <div className="card">
          <div className="text-xs text-gray-600 mb-1">Items Sold</div>
          <div className="text-xl font-bold text-gray-900">{totalStats.totalItemsSold}</div>
        </div>
        <div className="card">
          <div className="text-xs text-gray-600 mb-1">Unique Items</div>
          <div className="text-xl font-bold text-gray-900">{totalStats.uniqueItems}</div>
        </div>
      </div>

      {/* Items Sold Table */}
      <div className="card mb-8">
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
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Unit Price</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Total Revenue</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">Days Sold</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {itemsSold.map((item, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-500">{index + 1}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.itemName}</td>
                  <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">{item.totalQuantity}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-600">
                    ₦{item.unitPrice.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
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
                  {totalStats.totalItemsSold}
                </td>
                <td className="px-4 py-3"></td>
                <td className="px-4 py-3 text-sm text-right font-bold text-green-600">
                  ₦{totalStats.totalRevenue.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                </td>
                <td className="px-4 py-3"></td>
              </tr>
            </tfoot>
          </table>
        </div>

        {itemsSold.length === 0 && (
          <div className="text-center py-12">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">No items sold in this period</p>
          </div>
        )}
      </div>

      {/* Daily Payments Breakdown */}
      <div className="card">
        <div className="flex items-center space-x-2 mb-4">
          <DollarSign className="w-5 h-5 text-green-600" />
          <h2 className="text-xl font-bold text-gray-900">Daily Payment Breakdown</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b-2 border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Date</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Cash</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Card</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Transfer</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {dailyPayments.map((payment, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {format(new Date(payment.date), 'EEEE, MMM dd, yyyy')}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-green-600">
                    ₦{payment.cash.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-blue-600">
                    ₦{payment.card.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-purple-600">
                    ₦{payment.transfer.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-bold text-gray-900">
                    ₦{payment.total.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-100 border-t-2 border-gray-300">
              <tr>
                <td className="px-4 py-3 text-sm font-bold text-gray-900">TOTAL</td>
                <td className="px-4 py-3 text-sm text-right font-bold text-green-600">
                  ₦{totalStats.totalCash.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                </td>
                <td className="px-4 py-3 text-sm text-right font-bold text-blue-600">
                  ₦{totalStats.totalCard.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                </td>
                <td className="px-4 py-3 text-sm text-right font-bold text-purple-600">
                  ₦{totalStats.totalTransfer.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                </td>
                <td className="px-4 py-3 text-sm text-right font-bold text-gray-900">
                  ₦{totalStats.totalRevenue.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {dailyPayments.length === 0 && (
          <div className="text-center py-12">
            <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">No payment data for this period</p>
          </div>
        )}
      </div>
    </div>
  )
}