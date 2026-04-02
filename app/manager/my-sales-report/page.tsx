'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Download, Package, DollarSign, Calendar, ClipboardList } from 'lucide-react'
import { format, subDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns'
import Link from 'next/link'

interface UserProfile { id: string; full_name: string }

interface ItemSale {
  itemName: string
  totalQuantity: number
  unitPrice: number
  totalRevenue: number
  frequency: number
  dailyBreakdown: { date: string; quantity: number; revenue: number }[]
}

interface RequisitionItem {
  itemName: string
  totalQuantity: number
  unit: string
  frequency: number
}

interface DailyPayments {
  date: string
  cash: number
  card: number
  transfer: number
  total: number
}

type DateRangeOption = 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'custom'

export default function MySalesReportPage() {
  const [managerId, setManagerId] = useState<string | null>(null)
  const [managerName, setManagerName] = useState('My Sales Report')

  const [dateRangeOption, setDateRangeOption] = useState<DateRangeOption>('this_week')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [showCustomDates, setShowCustomDates] = useState(false)

  const [loading, setLoading] = useState(true)
  const [itemsSold, setItemsSold] = useState<ItemSale[]>([])
  const [requisitionItems, setRequisitionItems] = useState<RequisitionItem[]>([])
  const [dailyPayments, setDailyPayments] = useState<DailyPayments[]>([])
  const [totalStats, setTotalStats] = useState({
    totalRevenue: 0, totalCash: 0, totalCard: 0, totalTransfer: 0,
    totalItemsSold: 0, uniqueItems: 0
  })

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      // Cast to typed interface to avoid Supabase never inference
      const { data } = await supabase
        .from('users')
        .select('id, full_name')
        .eq('id', user.id)
        .single()
      const profile = data as UserProfile | null
      if (profile) {
        setManagerId(profile.id)
        setManagerName(profile.full_name)
      }
    }
    init()
  }, [])

  useEffect(() => {
    if (managerId) updateDateRange('this_week')
  }, [managerId])

  const updateDateRange = (option: DateRangeOption) => {
    const today = new Date()
    let start: Date, end: Date
    switch (option) {
      case 'today': start = today; end = today; break
      case 'yesterday': start = subDays(today, 1); end = subDays(today, 1); break
      case 'this_week':
        start = startOfWeek(today, { weekStartsOn: 1 }); end = endOfWeek(today, { weekStartsOn: 1 }); break
      case 'last_week': {
        const lw = subDays(today, 7)
        start = startOfWeek(lw, { weekStartsOn: 1 }); end = endOfWeek(lw, { weekStartsOn: 1 }); break
      }
      case 'this_month': start = startOfMonth(today); end = endOfMonth(today); break
      case 'last_month': {
        const lm = subDays(startOfMonth(today), 1)
        start = startOfMonth(lm); end = endOfMonth(lm); break
      }
      case 'custom': setShowCustomDates(true); setDateRangeOption('custom'); return
      default: start = startOfWeek(today, { weekStartsOn: 1 }); end = endOfWeek(today, { weekStartsOn: 1 })
    }
    const s = format(start, 'yyyy-MM-dd'), e = format(end, 'yyyy-MM-dd')
    setStartDate(s); setEndDate(e); setShowCustomDates(false); setDateRangeOption(option)
    if (managerId) loadSalesDetail(managerId, s, e)
  }

  const handleCustomApply = () => {
    if (startDate && endDate && managerId) {
      setDateRangeOption('custom'); setShowCustomDates(false)
      loadSalesDetail(managerId, startDate, endDate)
    }
  }

  const loadSalesDetail = async (id: string, start: string, end: string) => {
    setLoading(true)
    try {
      const [stockReports, stockItems] = await Promise.all([
        supabase.from('stock_inventory_reports').select('*')
          .eq('manager_id', id).gte('report_date', start).lte('report_date', end)
          .eq('status', 'approved').order('report_date'),
        supabase.from('stock_inventory_items')
          .select('*, stock_inventory_reports!inner(report_date, manager_id, status)')
          .eq('stock_inventory_reports.manager_id', id)
          .gte('stock_inventory_reports.report_date', start)
          .lte('stock_inventory_reports.report_date', end)
          .eq('stock_inventory_reports.status', 'approved')
      ])

      const payments: DailyPayments[] = (stockReports.data || []).map((r: Record<string, unknown>) => ({
        date: r.report_date as string,
        cash: (r.cash_payments as number) || 0,
        card: (r.card_payments as number) || 0,
        transfer: (r.transfer_payments as number) || 0,
        total: ((r.cash_payments as number) || 0) + ((r.card_payments as number) || 0) + ((r.transfer_payments as number) || 0)
      }))
      setDailyPayments(payments)

      const allItems = (stockItems.data || []) as Record<string, unknown>[]

      const salesItems = allItems.filter(i => i.item_section === 'sales')
      const salesMap: Record<string, { quantity: number; unitPrice: number; revenue: number; frequency: number; dailyBreakdown: { date: string; quantity: number; revenue: number }[] }> = {}
      salesItems.forEach(item => {
        const name = item.item_name as string
        const report = item.stock_inventory_reports as Record<string, unknown>
        const date = report.report_date as string
        const qty = (item.quantity as number) || 0
        const price = (item.unit_price as number) || 0
        const rev = qty * price
        if (!salesMap[name]) salesMap[name] = { quantity: 0, unitPrice: price, revenue: 0, frequency: 0, dailyBreakdown: [] }
        salesMap[name].quantity += qty
        salesMap[name].revenue += rev
        salesMap[name].frequency += 1
        salesMap[name].dailyBreakdown.push({ date, quantity: qty, revenue: rev })
      })
      const items: ItemSale[] = Object.entries(salesMap)
        .map(([itemName, d]) => ({ itemName, totalQuantity: d.quantity, unitPrice: d.unitPrice, totalRevenue: d.revenue, frequency: d.frequency, dailyBreakdown: d.dailyBreakdown }))
        .sort((a, b) => b.totalRevenue - a.totalRevenue)
      setItemsSold(items)

      const reqItems = allItems.filter(i => i.item_section !== 'sales')
      const reqMap: Record<string, { quantity: number; unit: string; frequency: number }> = {}
      reqItems.forEach(item => {
        const name = item.item_name as string
        const qty = (item.quantity as number) || 0
        const unit = (item.unit as string) || ''
        if (!reqMap[name]) reqMap[name] = { quantity: 0, unit, frequency: 0 }
        reqMap[name].quantity += qty
        reqMap[name].frequency += 1
      })
      const requisitions: RequisitionItem[] = Object.entries(reqMap)
        .map(([itemName, d]) => ({ itemName, totalQuantity: d.quantity, unit: d.unit, frequency: d.frequency }))
        .sort((a, b) => b.totalQuantity - a.totalQuantity)
      setRequisitionItems(requisitions)

      const totalRevenue = payments.reduce((s, p) => s + p.total, 0)
      const totalCash = payments.reduce((s, p) => s + p.cash, 0)
      const totalCard = payments.reduce((s, p) => s + p.card, 0)
      const totalTransfer = payments.reduce((s, p) => s + p.transfer, 0)
      const totalItemsSold = items.reduce((s, i) => s + i.totalQuantity, 0)
      setTotalStats({ totalRevenue, totalCash, totalCard, totalTransfer, totalItemsSold, uniqueItems: items.length })
    } catch (error) { console.error('Error loading sales detail:', error) }
    finally { setLoading(false) }
  }

  const nairaFmt = (n: number) => `₦${n.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`

  const exportToExcel = async () => {
    const XLSX = await import('xlsx')
    const wb = XLSX.utils.book_new()
    const period = startDate && endDate
      ? `${format(new Date(startDate), 'MMM dd, yyyy')} - ${format(new Date(endDate), 'MMM dd, yyyy')}`
      : 'All time'

    const s1: (string | number)[][] = [
      [`${managerName} — My Sales Report`], [`Period: ${period}`], [],
      ['PAYMENT SUMMARY', ''], ['Payment Type', 'Amount (₦)'],
      ['Cash', totalStats.totalCash], ['Card / POS', totalStats.totalCard],
      ['Transfer', totalStats.totalTransfer], ['TOTAL REVENUE', totalStats.totalRevenue],
      [], ['ITEMS SUMMARY', ''], ['Metric', 'Value'],
      ['Total Items Sold (qty)', totalStats.totalItemsSold],
      ['Unique Products Sold', totalStats.uniqueItems],
      ['Requisition Items', requisitionItems.length],
    ]
    const ws1 = XLSX.utils.aoa_to_sheet(s1)
    ws1['!cols'] = [{ wch: 30 }, { wch: 22 }]
    XLSX.utils.book_append_sheet(wb, ws1, 'Summary')

    const s2: (string | number)[][] = [['#', 'Item Name', 'Unit Price (₦)', 'Total Qty Sold', 'Total Revenue (₦)', 'Days Sold']]
    itemsSold.forEach((item, i) => s2.push([i + 1, item.itemName, item.unitPrice, item.totalQuantity, item.totalRevenue, item.frequency]))
    s2.push(['', 'TOTAL', '', totalStats.totalItemsSold, totalStats.totalRevenue, ''])
    const ws2 = XLSX.utils.aoa_to_sheet(s2)
    ws2['!cols'] = [{ wch: 5 }, { wch: 30 }, { wch: 16 }, { wch: 16 }, { wch: 20 }, { wch: 12 }]
    XLSX.utils.book_append_sheet(wb, ws2, 'Items Sold')

    const s3: (string | number)[][] = [['Date', 'Cash (₦)', 'Card (₦)', 'Transfer (₦)', 'Total (₦)']]
    dailyPayments.forEach(p => s3.push([format(new Date(p.date), 'EEE MMM dd yyyy'), p.cash, p.card, p.transfer, p.total]))
    s3.push(['TOTAL', totalStats.totalCash, totalStats.totalCard, totalStats.totalTransfer, totalStats.totalRevenue])
    const ws3 = XLSX.utils.aoa_to_sheet(s3)
    ws3['!cols'] = [{ wch: 24 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }]
    XLSX.utils.book_append_sheet(wb, ws3, 'Daily Payments')

    if (requisitionItems.length > 0) {
      const s4: (string | number)[][] = [['#', 'Item Name', 'Total Qty Requisitioned', 'Unit', 'Number of Reports']]
      requisitionItems.forEach((item, i) => s4.push([i + 1, item.itemName, item.totalQuantity, item.unit || '—', item.frequency]))
      const ws4 = XLSX.utils.aoa_to_sheet(s4)
      ws4['!cols'] = [{ wch: 5 }, { wch: 30 }, { wch: 24 }, { wch: 12 }, { wch: 18 }]
      XLSX.utils.book_append_sheet(wb, ws4, 'Requisitions')
    }

    XLSX.writeFile(wb, `my-sales-report-${format(new Date(), 'yyyy-MM-dd')}.xlsx`)
  }

  const dateRangeLabel = startDate && endDate
    ? `${format(new Date(startDate), 'MMM dd, yyyy')} - ${format(new Date(endDate), 'MMM dd, yyyy')}`
    : 'Select a date range'

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <Link href="/manager/dashboard" className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-4 text-sm">
          <ArrowLeft className="w-4 h-4 mr-2" />Back to Dashboard
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">My Sales Performance</h1>
            <p className="text-gray-600">Your approved sales reports • {dateRangeLabel}</p>
          </div>
          <button onClick={exportToExcel} className="btn-primary flex items-center space-x-2">
            <Download className="w-4 h-4" /><span>Export to Excel</span>
          </button>
        </div>
      </div>

      {/* Date Range Selector */}
      <div className="card bg-blue-50 border-blue-200 mb-8">
        <div className="flex items-center space-x-2 mb-3">
          <Calendar className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-blue-900">Date Range</h3>
        </div>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {([
            { value: 'today', label: 'Today' }, { value: 'yesterday', label: 'Yesterday' },
            { value: 'this_week', label: 'This Week' }, { value: 'last_week', label: 'Last Week' },
            { value: 'this_month', label: 'This Month' }, { value: 'last_month', label: 'Last Month' },
            { value: 'custom', label: 'Custom Range' },
          ] as { value: DateRangeOption; label: string }[]).map(o => (
            <button key={o.value} onClick={() => updateDateRange(o.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${dateRangeOption === o.value ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-blue-100'}`}>
              {o.label}
            </button>
          ))}
        </div>
        {showCustomDates && (
          <div className="flex items-center gap-3 p-3 bg-white rounded-lg">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Start Date</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="input-field text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">End Date</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="input-field text-sm" />
            </div>
            <button onClick={handleCustomApply} className="mt-5 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">Apply</button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <div className="text-lg text-gray-600">Loading your sales data...</div>
          </div>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
            <div className="card bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
              <div className="text-xs text-gray-600 mb-1">Total Revenue</div>
              <div className="text-xl font-bold text-gray-900">{nairaFmt(totalStats.totalRevenue)}</div>
            </div>
            <div className="card"><div className="text-xs text-gray-600 mb-1">Cash</div><div className="text-xl font-bold text-green-600">{nairaFmt(totalStats.totalCash)}</div></div>
            <div className="card"><div className="text-xs text-gray-600 mb-1">Card</div><div className="text-xl font-bold text-blue-600">{nairaFmt(totalStats.totalCard)}</div></div>
            <div className="card"><div className="text-xs text-gray-600 mb-1">Transfer</div><div className="text-xl font-bold text-purple-600">{nairaFmt(totalStats.totalTransfer)}</div></div>
            <div className="card"><div className="text-xs text-gray-600 mb-1">Items Sold</div><div className="text-xl font-bold text-gray-900">{totalStats.totalItemsSold}</div></div>
            <div className="card"><div className="text-xs text-gray-600 mb-1">Unique Items</div><div className="text-xl font-bold text-gray-900">{totalStats.uniqueItems}</div></div>
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
                      <td className="px-4 py-3 text-sm text-right text-gray-600">{nairaFmt(item.unitPrice)}</td>
                      <td className="px-4 py-3 text-sm text-right font-bold text-green-600">{nairaFmt(item.totalRevenue)}</td>
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
                    <td className="px-4 py-3 text-sm text-right font-bold text-gray-900">{totalStats.totalItemsSold}</td>
                    <td className="px-4 py-3"></td>
                    <td className="px-4 py-3 text-sm text-right font-bold text-green-600">{nairaFmt(totalStats.totalRevenue)}</td>
                    <td className="px-4 py-3"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
            {itemsSold.length === 0 && (
              <div className="text-center py-12">
                <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600">No approved sales reports found for this period</p>
              </div>
            )}
          </div>

          {/* Requisitioned Items */}
          {requisitionItems.length > 0 && (
            <div className="card mb-8">
              <div className="flex items-center space-x-2 mb-4">
                <ClipboardList className="w-5 h-5 text-indigo-600" />
                <h2 className="text-xl font-bold text-gray-900">Requisitioned Items</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b-2 border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">#</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Item Name</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Total Qty</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Unit</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">Reports</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {requisitionItems.map((item, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-500">{index + 1}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.itemName}</td>
                        <td className="px-4 py-3 text-sm text-right font-semibold text-indigo-600">{item.totalQuantity}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{item.unit || '—'}</td>
                        <td className="px-4 py-3 text-sm text-center">
                          <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium">
                            {item.frequency} {item.frequency === 1 ? 'report' : 'reports'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Daily Payments */}
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
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{format(new Date(payment.date), 'EEE, MMM dd yyyy')}</td>
                      <td className="px-4 py-3 text-sm text-right text-green-600">{nairaFmt(payment.cash)}</td>
                      <td className="px-4 py-3 text-sm text-right text-blue-600">{nairaFmt(payment.card)}</td>
                      <td className="px-4 py-3 text-sm text-right text-purple-600">{nairaFmt(payment.transfer)}</td>
                      <td className="px-4 py-3 text-sm text-right font-bold text-gray-900">{nairaFmt(payment.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-100 border-t-2 border-gray-300">
                  <tr>
                    <td className="px-4 py-3 text-sm font-bold text-gray-900">TOTAL</td>
                    <td className="px-4 py-3 text-sm text-right font-bold text-green-600">{nairaFmt(totalStats.totalCash)}</td>
                    <td className="px-4 py-3 text-sm text-right font-bold text-blue-600">{nairaFmt(totalStats.totalCard)}</td>
                    <td className="px-4 py-3 text-sm text-right font-bold text-purple-600">{nairaFmt(totalStats.totalTransfer)}</td>
                    <td className="px-4 py-3 text-sm text-right font-bold text-gray-900">{nairaFmt(totalStats.totalRevenue)}</td>
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
        </>
      )}
    </div>
  )
}