'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Download, Hotel, Calendar } from 'lucide-react'
import { format, subDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns'
import Link from 'next/link'

interface UserProfile { id: string; full_name: string }

interface OtherRevenueItem {
  type: string
  amount: number
  cash: number
  card: { bank: string; amount: number }[]
  transfer: { bank: string; amount: number }[]
}

interface DailyRevenue {
  date: string
  roomRevenue: number
  laundryRevenue: number
  otherRevenue: number
  otherRevenueItems: OtherRevenueItem[]
  totalRevenue: number
  occupancyRate: number
  totalRooms: number
  occupiedRooms: number
}

type DateRangeOption = 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'custom'

export default function MyRevenueReportPage() {
  const [managerId, setManagerId] = useState<string | null>(null)
  const [managerName, setManagerName] = useState('My Revenue Report')

  const [dateRangeOption, setDateRangeOption] = useState<DateRangeOption>('this_week')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [showCustomDates, setShowCustomDates] = useState(false)
  const [expandedOtherRows, setExpandedOtherRows] = useState<Set<number>>(new Set())

  const [loading, setLoading] = useState(true)
  const [dailyRevenue, setDailyRevenue] = useState<DailyRevenue[]>([])
  const [totalStats, setTotalStats] = useState({
    totalRevenue: 0, totalRoom: 0, totalLaundry: 0,
    totalOther: 0, avgOccupancy: 0, totalRoomNights: 0
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
    if (managerId) loadRevenueDetail(managerId, s, e)
  }

  const handleCustomApply = () => {
    if (startDate && endDate && managerId) {
      setDateRangeOption('custom'); setShowCustomDates(false)
      loadRevenueDetail(managerId, startDate, endDate)
    }
  }

  const parseOtherServicesFromNotes = (notes: string | null): OtherRevenueItem[] => {
    if (!notes) return []
    try {
      const marker = '__PAYMENT_BREAKDOWN__'
      const idx = notes.indexOf(marker)
      if (idx === -1) return []
      const json = JSON.parse(notes.slice(idx + marker.length).trim())
      return (json.other_services || []) as OtherRevenueItem[]
    } catch { return [] }
  }

  const loadRevenueDetail = async (id: string, start: string, end: string) => {
    setLoading(true)
    try {
      const [revenueReports, occupancyReports] = await Promise.all([
        supabase.from('revenue_reports').select('*')
          .eq('manager_id', id).gte('report_date', start).lte('report_date', end)
          .eq('status', 'approved').order('report_date'),
        supabase.from('occupancy_reports').select('*')
          .eq('manager_id', id).gte('report_date', start).lte('report_date', end)
          .eq('status', 'approved').order('report_date')
      ])

      const occupancyMap = new Map(
        (occupancyReports.data || []).map((o: Record<string, unknown>) => [
          o.report_date as string,
          { rate: (o.occupancy_percentage as number) || 0, total: (o.total_rooms as number) || 0, occupied: (o.occupied_rooms as number) || 0 }
        ])
      )

      const dailyData: DailyRevenue[] = (revenueReports.data || []).map((r: Record<string, unknown>) => {
        const occ = occupancyMap.get(r.report_date as string) || { rate: 0, total: 0, occupied: 0 }
        const roomRevenue = (r.room_revenue as number) || 0
        const laundryRevenue = (r.laundry_revenue as number) || 0
        const otherRevenue = (r.other_services_revenue as number) || 0
        const otherRevenueItems = parseOtherServicesFromNotes(r.notes as string | null)
        return {
          date: r.report_date as string, roomRevenue, laundryRevenue, otherRevenue, otherRevenueItems,
          totalRevenue: roomRevenue + laundryRevenue + otherRevenue,
          occupancyRate: occ.rate, totalRooms: occ.total, occupiedRooms: occ.occupied
        }
      })

      setDailyRevenue(dailyData)
      const totalRevenue = dailyData.reduce((s, d) => s + d.totalRevenue, 0)
      const totalRoom = dailyData.reduce((s, d) => s + d.roomRevenue, 0)
      const totalLaundry = dailyData.reduce((s, d) => s + d.laundryRevenue, 0)
      const totalOther = dailyData.reduce((s, d) => s + d.otherRevenue, 0)
      const avgOccupancy = dailyData.length > 0 ? dailyData.reduce((s, d) => s + d.occupancyRate, 0) / dailyData.length : 0
      const totalRoomNights = dailyData.reduce((s, d) => s + d.occupiedRooms, 0)
      setTotalStats({ totalRevenue, totalRoom, totalLaundry, totalOther, avgOccupancy, totalRoomNights })
    } catch (error) { console.error('Error loading revenue detail:', error) }
    finally { setLoading(false) }
  }

  const toggleOtherRow = (i: number) => setExpandedOtherRows(prev => {
    const next = new Set(prev); next.has(i) ? next.delete(i) : next.add(i); return next
  })

  const nairaFmt = (n: number) => `₦${n.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`

  const exportToExcel = async () => {
    const XLSX = await import('xlsx')
    const wb = XLSX.utils.book_new()
    const period = startDate && endDate
      ? `${format(new Date(startDate), 'MMM dd, yyyy')} - ${format(new Date(endDate), 'MMM dd, yyyy')}`
      : 'All time'

    const s1: (string | number)[][] = [
      [`${managerName} — My Revenue Report`], [`Period: ${period}`], [],
      ['REVENUE SUMMARY', ''], ['Category', 'Amount (₦)'],
      ['Room Revenue', totalStats.totalRoom], ['Laundry Revenue', totalStats.totalLaundry],
      ['Other Services Revenue', totalStats.totalOther], ['TOTAL REVENUE', totalStats.totalRevenue],
      [], ['OCCUPANCY SUMMARY', ''], ['Metric', 'Value'],
      ['Average Occupancy', `${totalStats.avgOccupancy.toFixed(1)}%`],
      ['Total Room Nights Sold', totalStats.totalRoomNights],
    ]
    const ws1 = XLSX.utils.aoa_to_sheet(s1)
    ws1['!cols'] = [{ wch: 32 }, { wch: 22 }]
    XLSX.utils.book_append_sheet(wb, ws1, 'Summary')

    const s2: (string | number)[][] = [
      ['Date', 'Room Revenue (₦)', 'Laundry Revenue (₦)', 'Other Revenue (₦)', 'Total Revenue (₦)', 'Occupancy %', 'Total Rooms', 'Occupied Rooms']
    ]
    dailyRevenue.forEach(d => s2.push([
      format(new Date(d.date), 'EEE MMM dd yyyy'),
      d.roomRevenue, d.laundryRevenue, d.otherRevenue, d.totalRevenue,
      parseFloat(d.occupancyRate.toFixed(1)), d.totalRooms, d.occupiedRooms
    ]))
    s2.push(['TOTAL / AVERAGE', totalStats.totalRoom, totalStats.totalLaundry, totalStats.totalOther,
      totalStats.totalRevenue, parseFloat(totalStats.avgOccupancy.toFixed(1)), '', totalStats.totalRoomNights])
    const ws2 = XLSX.utils.aoa_to_sheet(s2)
    ws2['!cols'] = [{ wch: 24 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 14 }, { wch: 14 }, { wch: 16 }]
    XLSX.utils.book_append_sheet(wb, ws2, 'Daily Breakdown')

    XLSX.writeFile(wb, `my-revenue-report-${format(new Date(), 'yyyy-MM-dd')}.xlsx`)
  }

  const dateRangeLabel = startDate && endDate
    ? `${format(new Date(startDate), 'MMM dd, yyyy')} - ${format(new Date(endDate), 'MMM dd, yyyy')}`
    : 'Select a date range'

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <Link href="/front-office/dashboard" className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-4 text-sm">
          <ArrowLeft className="w-4 h-4 mr-2" />Back to Dashboard
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">My Revenue Performance</h1>
            <p className="text-gray-600">Your approved revenue reports • {dateRangeLabel}</p>
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
            <div className="text-lg text-gray-600">Loading your revenue data...</div>
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
            <div className="card"><div className="text-xs text-gray-600 mb-1">Room Revenue</div><div className="text-xl font-bold text-green-600">{nairaFmt(totalStats.totalRoom)}</div></div>
            <div className="card"><div className="text-xs text-gray-600 mb-1">Laundry</div><div className="text-xl font-bold text-blue-600">{nairaFmt(totalStats.totalLaundry)}</div></div>
            <div className="card"><div className="text-xs text-gray-600 mb-1">Other Revenue</div><div className="text-xl font-bold text-purple-600">{nairaFmt(totalStats.totalOther)}</div></div>
            <div className="card"><div className="text-xs text-gray-600 mb-1">Avg Occupancy</div><div className="text-xl font-bold text-orange-600">{totalStats.avgOccupancy.toFixed(1)}%</div></div>
            <div className="card"><div className="text-xs text-gray-600 mb-1">Room Nights</div><div className="text-xl font-bold text-gray-900">{totalStats.totalRoomNights}</div></div>
          </div>

          {/* Daily Revenue Table */}
          <div className="card">
            <div className="flex items-center space-x-2 mb-4">
              <Hotel className="w-5 h-5 text-green-600" />
              <h2 className="text-xl font-bold text-gray-900">Daily Revenue & Occupancy Breakdown</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b-2 border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Date</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Room Revenue</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Laundry</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Other Revenue</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Total Revenue</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">Occupancy</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">Rooms</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {dailyRevenue.map((day, index) => (
                    <>
                      <tr key={`row-${index}`} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{format(new Date(day.date), 'EEE, MMM dd yyyy')}</td>
                        <td className="px-4 py-3 text-sm text-right text-green-600 font-semibold">{nairaFmt(day.roomRevenue)}</td>
                        <td className="px-4 py-3 text-sm text-right text-blue-600">{nairaFmt(day.laundryRevenue)}</td>
                        <td className="px-4 py-3 text-sm text-right text-purple-600">
                          <div className="flex items-center justify-end gap-2">
                            <span>{nairaFmt(day.otherRevenue)}</span>
                            {day.otherRevenueItems.length > 0 && (
                              <button onClick={() => toggleOtherRow(index)}
                                className="text-xs bg-purple-100 text-purple-700 hover:bg-purple-200 px-2 py-0.5 rounded-full whitespace-nowrap">
                                {expandedOtherRows.has(index) ? 'hide' : day.otherRevenueItems.map(i => i.type).join(', ')}
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-bold text-gray-900">{nairaFmt(day.totalRevenue)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            day.occupancyRate >= 80 ? 'bg-green-100 text-green-700' :
                            day.occupancyRate >= 60 ? 'bg-blue-100 text-blue-700' :
                            day.occupancyRate >= 40 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                          }`}>{day.occupancyRate.toFixed(1)}%</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-center text-gray-600">{day.occupiedRooms} / {day.totalRooms}</td>
                      </tr>
                      {expandedOtherRows.has(index) && day.otherRevenueItems.length > 0 && (
                        <tr key={`expand-${index}`}>
                          <td colSpan={7} className="px-6 py-3 bg-purple-50 border-b border-purple-100">
                            <div className="space-y-2">
                              {day.otherRevenueItems.map((item, ii) => (
                                <div key={ii} className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                                  <span className="font-bold text-purple-900">{item.type}</span>
                                  <span className="text-gray-700">Total: <strong>{nairaFmt(item.amount)}</strong></span>
                                  {(item.cash || 0) > 0 && <span className="text-green-700">Cash: {nairaFmt(item.cash || 0)}</span>}
                                  {item.card.filter(p => p.amount > 0).map((p, pi) => (
                                    <span key={pi} className="text-blue-700">Card — {p.bank}: {nairaFmt(p.amount)}</span>
                                  ))}
                                  {item.transfer.filter(p => p.amount > 0).map((p, pi) => (
                                    <span key={pi} className="text-indigo-700">Transfer — {p.bank}: {nairaFmt(p.amount)}</span>
                                  ))}
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
                <tfoot className="bg-gray-100 border-t-2 border-gray-300">
                  <tr>
                    <td className="px-4 py-3 text-sm font-bold text-gray-900">TOTAL / AVERAGE</td>
                    <td className="px-4 py-3 text-sm text-right font-bold text-green-600">{nairaFmt(totalStats.totalRoom)}</td>
                    <td className="px-4 py-3 text-sm text-right font-bold text-blue-600">{nairaFmt(totalStats.totalLaundry)}</td>
                    <td className="px-4 py-3 text-sm text-right font-bold text-purple-600">{nairaFmt(totalStats.totalOther)}</td>
                    <td className="px-4 py-3 text-sm text-right font-bold text-gray-900">{nairaFmt(totalStats.totalRevenue)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-3 py-1 bg-gray-200 text-gray-900 rounded-full text-xs font-bold">{totalStats.avgOccupancy.toFixed(1)}%</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-center font-bold text-gray-900">{totalStats.totalRoomNights} nights</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            {dailyRevenue.length === 0 && (
              <div className="text-center py-12">
                <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600">No approved revenue reports found for this period</p>
              </div>
            )}
          </div>

          {/* Revenue Distribution */}
          {dailyRevenue.length > 0 && (
            <div className="card mt-8">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Revenue Distribution</h3>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Room Revenue', v: totalStats.totalRoom, bg: 'bg-green-50', tc: 'text-green-600' },
                  { label: 'Laundry Revenue', v: totalStats.totalLaundry, bg: 'bg-blue-50', tc: 'text-blue-600' },
                  { label: 'Other Revenue', v: totalStats.totalOther, bg: 'bg-purple-50', tc: 'text-purple-600' },
                ].map(item => (
                  <div key={item.label} className={`p-4 ${item.bg} rounded-lg`}>
                    <div className="text-sm text-gray-600 mb-1">{item.label}</div>
                    <div className={`text-2xl font-bold ${item.tc}`}>
                      {totalStats.totalRevenue > 0 ? ((item.v / totalStats.totalRevenue) * 100).toFixed(1) : '0.0'}%
                    </div>
                    <div className="text-xs text-gray-500 mt-1">{nairaFmt(item.v)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}