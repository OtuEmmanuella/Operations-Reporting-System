'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useSearchParams } from 'next/navigation'
import { ArrowLeft, Download, Hotel, Calendar } from 'lucide-react'
import { format } from 'date-fns'

interface DailyRevenue {
  date: string
  roomRevenue: number
  laundryRevenue: number
  otherRevenue: number
  totalRevenue: number
  occupancyRate: number
  totalRooms: number
  occupiedRooms: number
}

export default function ManagerRevenueDetailPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  
  const managerId = params.id as string
  const managerName = searchParams.get('name') || 'Front Office Manager'
  const start = searchParams.get('start') || ''
  const end = searchParams.get('end') || ''
  
  const [loading, setLoading] = useState(true)
  const [dailyRevenue, setDailyRevenue] = useState<DailyRevenue[]>([])
  const [totalStats, setTotalStats] = useState({
    totalRevenue: 0,
    totalRoom: 0,
    totalLaundry: 0,
    totalOther: 0,
    avgOccupancy: 0,
    totalRoomNights: 0
  })

  useEffect(() => {
    loadRevenueDetail()
  }, [])

  const loadRevenueDetail = async () => {
    setLoading(true)
    try {
      console.log('📊 Loading revenue detail for FOM:', managerId)

      // Load revenue and occupancy reports
      const [revenueReports, occupancyReports] = await Promise.all([
        supabase
          .from('revenue_reports')
          .select('*')
          .eq('manager_id', managerId)
          .gte('report_date', start)
          .lte('report_date', end)
          .eq('status', 'approved')
          .order('report_date'),
        supabase
          .from('occupancy_reports')
          .select('*')
          .eq('manager_id', managerId)
          .gte('report_date', start)
          .lte('report_date', end)
          .eq('status', 'approved')
          .order('report_date')
      ])

      // Merge revenue and occupancy by date
      const dailyData: DailyRevenue[] = []
      const occupancyMap = new Map(
        (occupancyReports.data || []).map((o: any) => [
          o.report_date,
          {
            rate: o.occupancy_percentage || 0,
            total: o.total_rooms || 0,
            occupied: o.occupied_rooms || 0
          }
        ])
      )

      ;(revenueReports.data || []).forEach((r: any) => {
        const occupancy = occupancyMap.get(r.report_date) || { rate: 0, total: 0, occupied: 0 }
        
        dailyData.push({
          date: r.report_date,
          roomRevenue: r.room_revenue || 0,
          laundryRevenue: r.laundry_revenue || 0,
          otherRevenue: r.other_revenue || 0,
          totalRevenue: (r.room_revenue || 0) + (r.laundry_revenue || 0) + (r.other_revenue || 0),
          occupancyRate: occupancy.rate,
          totalRooms: occupancy.total,
          occupiedRooms: occupancy.occupied
        })
      })

      setDailyRevenue(dailyData)

      // Calculate totals
      const totalRevenue = dailyData.reduce((sum, d) => sum + d.totalRevenue, 0)
      const totalRoom = dailyData.reduce((sum, d) => sum + d.roomRevenue, 0)
      const totalLaundry = dailyData.reduce((sum, d) => sum + d.laundryRevenue, 0)
      const totalOther = dailyData.reduce((sum, d) => sum + d.otherRevenue, 0)
      const avgOccupancy = dailyData.length > 0
        ? dailyData.reduce((sum, d) => sum + d.occupancyRate, 0) / dailyData.length
        : 0
      const totalRoomNights = dailyData.reduce((sum, d) => sum + d.occupiedRooms, 0)

      setTotalStats({
        totalRevenue,
        totalRoom,
        totalLaundry,
        totalOther,
        avgOccupancy,
        totalRoomNights
      })

    } catch (error) {
      console.error('Error loading revenue detail:', error)
    } finally {
      setLoading(false)
    }
  }

  const exportToExcel = () => {
    let csv = `${managerName} - Detailed Revenue Report\n`
    csv += `Period: ${format(new Date(start), 'MMM dd, yyyy')} - ${format(new Date(end), 'MMM dd, yyyy')}\n\n`
    
    csv += `SUMMARY\n`
    csv += `Total Revenue,₦${totalStats.totalRevenue.toLocaleString()}\n`
    csv += `Room Revenue,₦${totalStats.totalRoom.toLocaleString()}\n`
    csv += `Laundry Revenue,₦${totalStats.totalLaundry.toLocaleString()}\n`
    csv += `Other Revenue,₦${totalStats.totalOther.toLocaleString()}\n`
    csv += `Average Occupancy,${totalStats.avgOccupancy.toFixed(1)}%\n`
    csv += `Total Room Nights,${totalStats.totalRoomNights}\n\n`

    csv += `DAILY BREAKDOWN\n`
    csv += `Date,Room Revenue,Laundry Revenue,Other Revenue,Total Revenue,Occupancy %,Total Rooms,Occupied Rooms\n`
    dailyRevenue.forEach(d => {
      csv += `${format(new Date(d.date), 'MMM dd, yyyy')},`
      csv += `₦${d.roomRevenue.toLocaleString()},`
      csv += `₦${d.laundryRevenue.toLocaleString()},`
      csv += `₦${d.otherRevenue.toLocaleString()},`
      csv += `₦${d.totalRevenue.toLocaleString()},`
      csv += `${d.occupancyRate.toFixed(1)}%,`
      csv += `${d.totalRooms},`
      csv += `${d.occupiedRooms}\n`
    })

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${managerName}-revenue-detail-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-lg text-gray-600">Loading revenue details...</div>
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
              Detailed Revenue & Occupancy Report • {format(new Date(start), 'MMM dd, yyyy')} - {format(new Date(end), 'MMM dd, yyyy')}
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
          <div className="text-xs text-gray-600 mb-1">Room Revenue</div>
          <div className="text-xl font-bold text-green-600">
            ₦{totalStats.totalRoom.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
          </div>
        </div>
        <div className="card">
          <div className="text-xs text-gray-600 mb-1">Laundry</div>
          <div className="text-xl font-bold text-blue-600">
            ₦{totalStats.totalLaundry.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
          </div>
        </div>
        <div className="card">
          <div className="text-xs text-gray-600 mb-1">Other Revenue</div>
          <div className="text-xl font-bold text-purple-600">
            ₦{totalStats.totalOther.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
          </div>
        </div>
        <div className="card">
          <div className="text-xs text-gray-600 mb-1">Avg Occupancy</div>
          <div className="text-xl font-bold text-orange-600">
            {totalStats.avgOccupancy.toFixed(1)}%
          </div>
        </div>
        <div className="card">
          <div className="text-xs text-gray-600 mb-1">Room Nights</div>
          <div className="text-xl font-bold text-gray-900">{totalStats.totalRoomNights}</div>
        </div>
      </div>

      {/* Daily Revenue & Occupancy Table */}
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
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Other</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Total Revenue</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">Occupancy</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">Rooms</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {dailyRevenue.map((day, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {format(new Date(day.date), 'EEEE, MMM dd, yyyy')}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-green-600 font-semibold">
                    ₦{day.roomRevenue.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-blue-600">
                    ₦{day.laundryRevenue.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-purple-600">
                    ₦{day.otherRevenue.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-bold text-gray-900">
                    ₦{day.totalRevenue.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      day.occupancyRate >= 80 ? 'bg-green-100 text-green-700' :
                      day.occupancyRate >= 60 ? 'bg-blue-100 text-blue-700' :
                      day.occupancyRate >= 40 ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {day.occupancyRate.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-center text-gray-600">
                    {day.occupiedRooms} / {day.totalRooms}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-100 border-t-2 border-gray-300">
              <tr>
                <td className="px-4 py-3 text-sm font-bold text-gray-900">TOTAL / AVERAGE</td>
                <td className="px-4 py-3 text-sm text-right font-bold text-green-600">
                  ₦{totalStats.totalRoom.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                </td>
                <td className="px-4 py-3 text-sm text-right font-bold text-blue-600">
                  ₦{totalStats.totalLaundry.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                </td>
                <td className="px-4 py-3 text-sm text-right font-bold text-purple-600">
                  ₦{totalStats.totalOther.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                </td>
                <td className="px-4 py-3 text-sm text-right font-bold text-gray-900">
                  ₦{totalStats.totalRevenue.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="px-3 py-1 bg-gray-200 text-gray-900 rounded-full text-xs font-bold">
                    {totalStats.avgOccupancy.toFixed(1)}%
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-center font-bold text-gray-900">
                  {totalStats.totalRoomNights} nights
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {dailyRevenue.length === 0 && (
          <div className="text-center py-12">
            <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">No revenue data for this period</p>
          </div>
        )}
      </div>

      {/* Revenue Distribution Chart */}
      {dailyRevenue.length > 0 && (
        <div className="card mt-8">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Revenue Distribution</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-green-50 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">Room Revenue</div>
              <div className="text-2xl font-bold text-green-600">
                {((totalStats.totalRoom / totalStats.totalRevenue) * 100).toFixed(1)}%
              </div>
              <div className="text-xs text-gray-500 mt-1">
                ₦{totalStats.totalRoom.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
              </div>
            </div>
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">Laundry Revenue</div>
              <div className="text-2xl font-bold text-blue-600">
                {((totalStats.totalLaundry / totalStats.totalRevenue) * 100).toFixed(1)}%
              </div>
              <div className="text-xs text-gray-500 mt-1">
                ₦{totalStats.totalLaundry.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
              </div>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">Other Revenue</div>
              <div className="text-2xl font-bold text-purple-600">
                {((totalStats.totalOther / totalStats.totalRevenue) * 100).toFixed(1)}%
              </div>
              <div className="text-xs text-gray-500 mt-1">
                ₦{totalStats.totalOther.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}