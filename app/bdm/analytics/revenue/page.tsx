'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabase'
import { 
  ArrowLeft, DollarSign, TrendingUp, TrendingDown, Hotel, 
  Calendar, Download, Info, Lightbulb, Target, ChevronDown, ChevronUp
} from 'lucide-react'
import { format, subDays, eachDayOfInterval, startOfMonth, endOfMonth } from 'date-fns'
import Link from 'next/link'

interface RevenueData {
  dailyRevenue: DailyRevenue[]
  revenueBreakdown: RevenueBreakdown
  occupancyData: DailyOccupancy[]
  insights: RevenueInsight[]
  forecast: ForecastData
  weekdayAnalysis: WeekdayAnalysis
  peakDays: { date: string; revenue: number; reason: string }[]
  lowDays: { date: string; revenue: number; reason: string }[]
}

interface DailyRevenue {
  date: string
  total: number
  room: number
  laundry: number
  other: number
}

interface RevenueBreakdown {
  room: { amount: number; percentage: number }
  laundry: { amount: number; percentage: number }
  other: { amount: number; percentage: number }
}

interface DailyOccupancy {
  date: string
  rate: number
  occupied: number
  total: number
}

interface RevenueInsight {
  id: string
  type: 'positive' | 'negative' | 'neutral'
  title: string
  description: string
  metric?: string
}

interface ForecastData {
  nextWeekRevenue: number
  confidence: number
  trend: 'up' | 'down' | 'stable'
  reasoning: string
}

interface WeekdayAnalysis {
  bestDay: { day: string; avgRevenue: number }
  worstDay: { day: string; avgRevenue: number }
  byDay: { day: string; avgRevenue: number }[]
}

export default function RevenueAnalyticsPage() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<RevenueData | null>(null)
  const [dateRange, setDateRange] = useState<'7d' | '30d' | 'month'>('30d')
  const [expandedChart, setExpandedChart] = useState<string>('revenue')
  const [showTooltip, setShowTooltip] = useState<string | null>(null)

  useEffect(() => {
    loadRevenueData()
  }, [dateRange])

 const loadRevenueData = async () => {
  setLoading(true)
  try {
    const { start, end } = getDateRange()
    const startDate = format(start, 'yyyy-MM-dd')
    const endDate = format(end, 'yyyy-MM-dd')

    // MERGE: Load both sales reports AND front office revenue reports
    const [salesReports, revenueReports, occupancies] = await Promise.all([
      supabase
        .from('sales_reports')
        .select('*')
        .gte('report_date', startDate)
        .lte('report_date', endDate)
        .eq('status', 'approved')
        .order('report_date'),
      supabase
        .from('revenue_reports')
        .select('*')
        .gte('report_date', startDate)
        .lte('report_date', endDate)
        .eq('status', 'approved')
        .order('report_date'),
      supabase
        .from('occupancy_reports')
        .select('*')
        .gte('report_date', startDate)
        .lte('report_date', endDate)
        .order('report_date'),
    ])

    // COMBINE sales and revenue data by date
    const combinedRevenueByDate: Record<string, {
      total: number
      room: number
      laundry: number
      other: number
      sales: number
    }> = {}

    // Add sales reports
    ;(salesReports.data || []).forEach(r => {
      const date = r.report_date
      if (!combinedRevenueByDate[date]) {
        combinedRevenueByDate[date] = { total: 0, room: 0, laundry: 0, other: 0, sales: 0 }
      }
      combinedRevenueByDate[date].sales += r.total_amount || 0
      combinedRevenueByDate[date].total += r.total_amount || 0
    })

    // Add revenue reports (front office)
    ;(revenueReports.data || []).forEach(r => {
      const date = r.report_date
      if (!combinedRevenueByDate[date]) {
        combinedRevenueByDate[date] = { total: 0, room: 0, laundry: 0, other: 0, sales: 0 }
      }
      combinedRevenueByDate[date].room += r.room_revenue || 0
      combinedRevenueByDate[date].laundry += r.laundry_revenue || 0
      combinedRevenueByDate[date].other += (r.food_beverage_revenue || 0) + (r.other_services_revenue || 0)
      combinedRevenueByDate[date].total += r.total_revenue || 0
    })

    // Convert to array
    const dailyRevenue: DailyRevenue[] = Object.keys(combinedRevenueByDate)
      .sort()
      .map(date => ({
        date,
        total: combinedRevenueByDate[date].total,
        room: combinedRevenueByDate[date].room,
        laundry: combinedRevenueByDate[date].laundry,
        other: combinedRevenueByDate[date].other + combinedRevenueByDate[date].sales, // Combine sales with other
      }))

    const breakdown = calculateRevenueBreakdown(dailyRevenue)
    const occupancy = processOccupancy(occupancies.data || [])
    const insights = generateRevenueInsights(dailyRevenue, occupancies.data || [])
    const forecast = generateForecast(dailyRevenue)
    const weekdayAnalysis = analyzeWeekdays(dailyRevenue)
    const { peakDays, lowDays } = identifyPeakAndLowDays(dailyRevenue, occupancies.data || [])

    setData({
      dailyRevenue,
      revenueBreakdown: breakdown,
      occupancyData: occupancy,
      insights,
      forecast,
      weekdayAnalysis,
      peakDays,
      lowDays,
    })
  } catch (error) {
    console.error('Error loading revenue data:', error)
  } finally {
    setLoading(false)
  }
}

const calculateRevenueBreakdown = (dailyRevenue: DailyRevenue[]): RevenueBreakdown => {
  const total = dailyRevenue.reduce((sum, d) => sum + d.total, 0)
  const room = dailyRevenue.reduce((sum, d) => sum + d.room, 0)
  const laundry = dailyRevenue.reduce((sum, d) => sum + d.laundry, 0)
  const other = dailyRevenue.reduce((sum, d) => sum + d.other, 0)

  return {
    room: { amount: room, percentage: total > 0 ? (room / total) * 100 : 0 },
    laundry: { amount: laundry, percentage: total > 0 ? (laundry / total) * 100 : 0 },
    other: { amount: other, percentage: total > 0 ? (other / total) * 100 : 0 },
  }
}

  const getDateRange = () => {
    const today = new Date()
    switch (dateRange) {
      case '7d': return { start: subDays(today, 7), end: today }
      case '30d': return { start: subDays(today, 30), end: today }
      case 'month': return { start: startOfMonth(today), end: endOfMonth(today) }
    }
  }

  const processDailyRevenue = (revenues: any[]): DailyRevenue[] => {
    return revenues.map(r => ({
      date: r.report_date,
      total: r.total_revenue || 0,
      room: r.room_revenue || 0,
      laundry: r.laundry_revenue || 0,
      other: (r.other_services_revenue || 0),
    }))
  }

  const calculateRevenueBreakdown = (revenues: any[]): RevenueBreakdown => {
    const total = revenues.reduce((sum, r) => sum + (r.total_revenue || 0), 0)
    const room = revenues.reduce((sum, r) => sum + (r.room_revenue || 0), 0)
    const laundry = revenues.reduce((sum, r) => sum + (r.laundry_revenue || 0), 0)
    const other = revenues.reduce((sum, r) => sum + (r.other_services_revenue || 0), 0)

    return {
      room: { amount: room, percentage: total > 0 ? (room / total) * 100 : 0 },
      laundry: { amount: laundry, percentage: total > 0 ? (laundry / total) * 100 : 0 },
      other: { amount: other, percentage: total > 0 ? (other / total) * 100 : 0 },
    }
  }

  const processOccupancy = (occupancies: any[]): DailyOccupancy[] => {
    return occupancies.map(o => ({
      date: o.report_date,
      rate: o.occupancy_percentage || 0,
      occupied: o.occupied_rooms || 0,
      total: o.total_rooms || 0,
    }))
  }

  const generateRevenueInsights = (revenues: any[], occupancies: any[]): RevenueInsight[] => {
    const insights: RevenueInsight[] = []

    // Calculate averages
    const avgRevenue = revenues.length > 0 
      ? revenues.reduce((sum, r) => sum + (r.total_revenue || 0), 0) / revenues.length 
      : 0
    const avgOccupancy = occupancies.length > 0
      ? occupancies.reduce((sum, o) => sum + (o.occupancy_percentage || 0), 0) / occupancies.length
      : 0

    // Revenue trend
    const recentRevenues = revenues.slice(-7)
    const recentAvg = recentRevenues.length > 0
      ? recentRevenues.reduce((s, r) => s + (r.total_revenue || 0), 0) / recentRevenues.length
      : 0
    const growth = avgRevenue > 0 ? ((recentAvg - avgRevenue) / avgRevenue) * 100 : 0

    if (growth > 15) {
      insights.push({
        id: '1',
        type: 'positive',
        title: 'Strong Revenue Momentum',
        description: `Recent revenue trend shows ${growth.toFixed(1)}% increase. Keep up the excellent work with current pricing and marketing strategies.`,
        metric: `+${growth.toFixed(1)}%`,
      })
    } else if (growth < -10) {
      insights.push({
        id: '2',
        type: 'negative',
        title: 'Revenue Decline Detected',
        description: `Revenue has dropped by ${Math.abs(growth).toFixed(1)}% in recent days. Review pricing strategy and launch promotional campaigns.`,
        metric: `${growth.toFixed(1)}%`,
      })
    }

    // Room revenue dominance
    const totalRevenue = revenues.reduce((sum, r) => sum + (r.total_revenue || 0), 0)
    const roomRevenue = revenues.reduce((sum, r) => sum + (r.room_revenue || 0), 0)
    const roomPercentage = totalRevenue > 0 ? (roomRevenue / totalRevenue) * 100 : 0

    if (roomPercentage > 85) {
      insights.push({
        id: '3',
        type: 'neutral',
        title: 'Revenue Highly Dependent on Rooms',
        description: `${roomPercentage.toFixed(0)}% of revenue comes from rooms. Consider promoting laundry and other services to diversify income streams.`,
        metric: `${roomPercentage.toFixed(0)}%`,
      })
    }

    // Occupancy-revenue correlation
    if (avgOccupancy > 70 && avgRevenue > 0) {
      const adr = roomRevenue / occupancies.reduce((sum, o) => sum + (o.occupied_rooms || 0), 0)
      insights.push({
        id: '4',
        type: 'positive',
        title: 'High Occupancy With Good ADR',
        description: `Occupancy at ${avgOccupancy.toFixed(1)}% with ADR of ₦${adr.toFixed(0)}. This is optimal performance.`,
        metric: `${avgOccupancy.toFixed(0)}% occupancy`,
      })
    } else if (avgOccupancy < 50) {
      insights.push({
        id: '5',
        type: 'negative',
        title: 'Low Occupancy Impact',
        description: `Occupancy at ${avgOccupancy.toFixed(1)}% is affecting revenue potential. Focus on increasing bookings through targeted marketing.`,
        metric: `${avgOccupancy.toFixed(0)}% occupancy`,
      })
    }

    // Weekend vs weekday
    const weekendRevenues = revenues.filter(r => {
      const day = new Date(r.report_date).getDay()
      return day === 0 || day === 6 // Sunday or Saturday
    })
    const weekdayRevenues = revenues.filter(r => {
      const day = new Date(r.report_date).getDay()
      return day > 0 && day < 6
    })
    const weekendAvg = weekendRevenues.length > 0
      ? weekendRevenues.reduce((s, r) => s + (r.total_revenue || 0), 0) / weekendRevenues.length
      : 0
    const weekdayAvg = weekdayRevenues.length > 0
      ? weekdayRevenues.reduce((s, r) => s + (r.total_revenue || 0), 0) / weekdayRevenues.length
      : 0

    if (weekendAvg > weekdayAvg * 1.3) {
      insights.push({
        id: '6',
        type: 'neutral',
        title: 'Weekend Revenue Surge',
        description: `Weekends generate ${((weekendAvg / weekdayAvg - 1) * 100).toFixed(0)}% more revenue than weekdays. Consider weekend packages and promotions.`,
      })
    } else if (weekdayAvg > weekendAvg * 1.2) {
      insights.push({
        id: '7',
        type: 'neutral',
        title: 'Strong Weekday Performance',
        description: 'Business travelers are driving weekday revenue. Partner with corporate clients for long-term contracts.',
      })
    }

    return insights
  }

  const generateForecast = (revenues: any[]): ForecastData => {
    if (revenues.length < 7) {
      return {
        nextWeekRevenue: 0,
        confidence: 0,
        trend: 'stable',
        reasoning: 'Insufficient data for forecasting',
      }
    }

    // Simple moving average forecast
    const last7Days = revenues.slice(-7)
    const avgLast7 = last7Days.reduce((s, r) => s + (r.total_revenue || 0), 0) / 7
    const previous7Days = revenues.slice(-14, -7)
    const avgPrev7 = previous7Days.length > 0
      ? previous7Days.reduce((s, r) => s + (r.total_revenue || 0), 0) / previous7Days.length
      : avgLast7

    const growth = avgPrev7 > 0 ? ((avgLast7 - avgPrev7) / avgPrev7) : 0
    const nextWeekRevenue = avgLast7 * 7 * (1 + growth)

    let trend: 'up' | 'down' | 'stable' = 'stable'
    if (growth > 0.05) trend = 'up'
    else if (growth < -0.05) trend = 'down'

    const confidence = revenues.length >= 30 ? 85 : revenues.length >= 14 ? 70 : 55

    let reasoning = ''
    if (trend === 'up') {
      reasoning = `Based on recent ${(growth * 100).toFixed(1)}% growth trend, revenue is expected to increase next week.`
    } else if (trend === 'down') {
      reasoning = `Recent ${(Math.abs(growth) * 100).toFixed(1)}% decline suggests lower revenue next week unless corrective actions are taken.`
    } else {
      reasoning = 'Revenue is stable. Expected to maintain current levels next week.'
    }

    return { nextWeekRevenue, confidence, trend, reasoning }
  }

  const analyzeWeekdays = (revenues: any[]): WeekdayAnalysis => {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const byDay = dayNames.map((day, index) => {
      const dayRevenues = revenues.filter(r => new Date(r.report_date).getDay() === index)
      const avgRevenue = dayRevenues.length > 0
        ? dayRevenues.reduce((s, r) => s + (r.total_revenue || 0), 0) / dayRevenues.length
        : 0
      return { day, avgRevenue }
    })

    const sorted = [...byDay].sort((a, b) => b.avgRevenue - a.avgRevenue)

    return {
      bestDay: sorted[0],
      worstDay: sorted[sorted.length - 1],
      byDay,
    }
  }

  const identifyPeakAndLowDays = (revenues: any[], occupancies: any[]) => {
    const sorted = [...revenues].sort((a, b) => (b.total_revenue || 0) - (a.total_revenue || 0))
    
    const peakDays = sorted.slice(0, 3).map(r => {
      const occ = occupancies.find(o => o.report_date === r.report_date)
      let reason = ''
      const dayName = format(new Date(r.report_date), 'EEEE')
      if (dayName === 'Friday' || dayName === 'Saturday') {
        reason = 'Weekend demand'
      } else if (occ && occ.occupancy_percentage > 85) {
        reason = 'High occupancy'
      } else {
        reason = 'Strong performance'
      }
      return { date: r.report_date, revenue: r.total_revenue || 0, reason }
    })

    const lowDays = sorted.slice(-3).reverse().map(r => {
      const occ = occupancies.find(o => o.report_date === r.report_date)
      let reason = ''
      if (occ && occ.occupancy_percentage < 40) {
        reason = 'Low occupancy'
      } else {
        reason = 'Below average performance'
      }
      return { date: r.report_date, revenue: r.total_revenue || 0, reason }
    })

    return { peakDays, lowDays }
  }

  const SimpleBarChart = ({ data, title }: { data: { label: string; value: number; color?: string }[]; title: string }) => {
    const maxValue = Math.max(...data.map(d => d.value))
    
    return (
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-3">{title}</h4>
        <div className="space-y-2">
          {data.map((item, index) => (
            <div key={index}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-gray-600 font-medium">{item.label}</span>
                <span className="text-gray-900 font-semibold">
                  ₦{item.value.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all ${item.color || 'bg-primary'}`}
                  style={{ width: `${(item.value / maxValue) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const LineChart = ({ data, title }: { data: { date: string; value: number }[]; title: string }) => {
    const maxValue = Math.max(...data.map(d => d.value))
    const minValue = Math.min(...data.map(d => d.value))
    const range = maxValue - minValue || 1

    return (
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-3">{title}</h4>
        <div className="relative h-48 bg-gray-50 rounded-lg p-4">
          {/* Y-axis labels */}
          <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between text-xs text-gray-500 pr-2">
            <span>₦{maxValue.toLocaleString('en-NG', { maximumFractionDigits: 0 })}</span>
            <span>₦{((maxValue + minValue) / 2).toLocaleString('en-NG', { maximumFractionDigits: 0 })}</span>
            <span>₦{minValue.toLocaleString('en-NG', { maximumFractionDigits: 0 })}</span>
          </div>

          {/* Chart area */}
          <div className="ml-16 h-full flex items-end space-x-1">
            {data.map((point, index) => {
              const heightPercent = ((point.value - minValue) / range) * 100
              return (
                <div key={index} className="flex-1 flex flex-col justify-end group relative">
                  <div
                    className="bg-primary hover:bg-primary-dark transition-all rounded-t cursor-pointer"
                    style={{ height: `${heightPercent}%` }}
                  >
                    {/* Tooltip on hover */}
                    <div className="hidden group-hover:block absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                      {format(new Date(point.date), 'MMM dd')}
                      <br />
                      ₦{point.value.toLocaleString()}
                      <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-4 border-transparent border-t-gray-900"></div>
                    </div>
                  </div>
                  {data.length <= 14 && (
                    <div className="text-xs text-gray-500 mt-1 text-center">
                      {format(new Date(point.date), 'dd')}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  <DonutChart
  data={[
    {
      label: 'Room Revenue',
      value: data.revenueBreakdown.room.amount,
      percentage: data.revenueBreakdown.room.percentage,
      color: '#10b981',
    },
    {
      label: 'Laundry Services',
      value: data.revenueBreakdown.laundry.amount,
      percentage: data.revenueBreakdown.laundry.percentage,
      color: '#3b82f6',
    },
    {
      label: 'Sales & Other Services',  // UPDATED LABEL
      value: data.revenueBreakdown.other.amount,
      percentage: data.revenueBreakdown.other.percentage,
      color: '#8b5cf6',
    },
  ]}
/>
    let cumulativePercentage = 0

    return (
      <div className="flex items-center space-x-6">
        {/* Donut */}
        <div className="relative w-40 h-40">
          <svg viewBox="0 0 100 100" className="transform -rotate-90">
            {data.map((item, index) => {
              const startAngle = (cumulativePercentage / 100) * 360
              const endAngle = ((cumulativePercentage + item.percentage) / 100) * 360
              cumulativePercentage += item.percentage

              // SVG path for donut segment
              const startX = 50 + 40 * Math.cos((startAngle * Math.PI) / 180)
              const startY = 50 + 40 * Math.sin((startAngle * Math.PI) / 180)
              const endX = 50 + 40 * Math.cos((endAngle * Math.PI) / 180)
              const endY = 50 + 40 * Math.sin((endAngle * Math.PI) / 180)
              const largeArc = item.percentage > 50 ? 1 : 0

              return (
                <path
                  key={index}
                  d={`M 50 50 L ${startX} ${startY} A 40 40 0 ${largeArc} 1 ${endX} ${endY} Z`}
                  fill={item.color}
                  stroke="white"
                  strokeWidth="2"
                />
              )
            })}
            {/* Center white circle */}
            <circle cx="50" cy="50" r="25" fill="white" />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-xs text-gray-500">Total</div>
              <div className="text-sm font-bold text-gray-900">100%</div>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="space-y-2 flex-1">
          {data.map((item, index) => (
            <div key={index} className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className={`w-4 h-4 rounded`} style={{ backgroundColor: item.color }}></div>
                <span className="text-sm text-gray-700">{item.label}</span>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-gray-900">{item.percentage.toFixed(1)}%</div>
                <div className="text-xs text-gray-500">
                  ₦{item.value.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-lg text-gray-600">Loading revenue analytics...</div>
        </div>
      </div>
    )
  }

  if (!data) return <div className="p-8 text-red-600">Failed to load data</div>

  const totalRevenue = data.dailyRevenue.reduce((sum, d) => sum + d.total, 0)

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link href="/bdm/analytics" className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-4 text-sm">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Analytics Dashboard
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Revenue Analytics</h1>
            <p className="text-gray-600">Deep insights into revenue trends and opportunities</p>
          </div>
          
          {/* Date Range */}
          <div className="flex items-center space-x-2">
            {[
              { value: '7d' as const, label: 'Last 7 Days' },
              { value: '30d' as const, label: 'Last 30 Days' },
              { value: 'month' as const, label: 'This Month' },
            ].map(option => (
              <button
                key={option.value}
                onClick={() => setDateRange(option.value)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  dateRange === option.value ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="card bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <div className="text-sm text-gray-600 mb-1">Total Revenue</div>
          <div className="text-2xl font-bold text-gray-900">
            ₦{totalRevenue.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Avg: ₦{(totalRevenue / data.dailyRevenue.length).toLocaleString('en-NG', { maximumFractionDigits: 0 })}/day
          </div>
        </div>

        <div className="card">
          <div className="text-sm text-gray-600 mb-1">Best Day</div>
          <div className="text-lg font-bold text-green-600">{data.weekdayAnalysis.bestDay.day}</div>
          <div className="text-xs text-gray-500 mt-1">
            Avg: ₦{data.weekdayAnalysis.bestDay.avgRevenue.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
          </div>
        </div>

        <div className="card">
          <div className="text-sm text-gray-600 mb-1">Room Revenue</div>
          <div className="text-lg font-bold text-gray-900">{data.revenueBreakdown.room.percentage.toFixed(0)}%</div>
          <div className="text-xs text-gray-500 mt-1">of total revenue</div>
        </div>

        <div className="card">
          <div className="text-sm text-gray-600 mb-1">Forecast Next Week</div>
          <div className="flex items-center space-x-2">
            {data.forecast.trend === 'up' ? (
              <TrendingUp className="w-5 h-5 text-green-500" />
            ) : data.forecast.trend === 'down' ? (
              <TrendingDown className="w-5 h-5 text-red-500" />
            ) : (
              <Target className="w-5 h-5 text-gray-500" />
            )}
            <div className="text-lg font-bold text-gray-900">
              ₦{data.forecast.nextWeekRevenue.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
            </div>
          </div>
          <div className="text-xs text-gray-500 mt-1">{data.forecast.confidence}% confidence</div>
        </div>
      </div>

      {/* Forecast Insight */}
      <div className="mb-8 p-4 bg-blue-50 border-l-4 border-blue-500 rounded-lg">
        <div className="flex items-start space-x-3">
          <Lightbulb className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <div className="font-semibold text-blue-900 mb-1">Revenue Forecast</div>
            <div className="text-sm text-blue-700">{data.forecast.reasoning}</div>
          </div>
        </div>
      </div>

      {/* Revenue Insights */}
      {data.insights.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Key Insights</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.insights.map(insight => (
              <div
                key={insight.id}
                className={`p-4 rounded-xl border-l-4 ${
                  insight.type === 'positive'
                    ? 'bg-green-50 border-green-500'
                    : insight.type === 'negative'
                    ? 'bg-red-50 border-red-500'
                    : 'bg-blue-50 border-blue-500'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className={`font-semibold ${
                    insight.type === 'positive' ? 'text-green-900' : insight.type === 'negative' ? 'text-red-900' : 'text-blue-900'
                  }`}>
                    {insight.title}
                  </div>
                  {insight.metric && (
                    <span className={`text-xs font-bold px-2 py-1 rounded ${
                      insight.type === 'positive' ? 'bg-green-100 text-green-700' : insight.type === 'negative' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {insight.metric}
                    </span>
                  )}
                </div>
                <div className={`text-sm ${
                  insight.type === 'positive' ? 'text-green-700' : insight.type === 'negative' ? 'text-red-700' : 'text-blue-700'
                }`}>
                  {insight.description}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Daily Revenue Trend */}
        <div className="card">
          <LineChart
            data={data.dailyRevenue.map(d => ({ date: d.date, value: d.total }))}
            title="Daily Revenue Trend"
          />
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <div className="text-xs text-gray-600 mb-1">📊 What this shows:</div>
            <div className="text-xs text-gray-700">
              Track daily revenue patterns to identify trends, peak days, and growth opportunities. 
              Hover over bars to see exact amounts.
            </div>
          </div>
        </div>

        {/* Revenue Breakdown */}
        <div className="card">
          <h4 className="text-sm font-semibold text-gray-700 mb-4">Revenue Sources</h4>
          <DonutChart
            data={[
              {
                label: 'Room Revenue',
                value: data.revenueBreakdown.room.amount,
                percentage: data.revenueBreakdown.room.percentage,
                color: '#10b981',
              },
              {
                label: 'Laundry Services',
                value: data.revenueBreakdown.laundry.amount,
                percentage: data.revenueBreakdown.laundry.percentage,
                color: '#3b82f6',
              },
              {
                label: 'Other Services',
                value: data.revenueBreakdown.other.amount,
                percentage: data.revenueBreakdown.other.percentage,
                color: '#8b5cf6',
              },
            ]}
          />
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <div className="text-xs text-gray-600 mb-1">💡 Recommendation:</div>
            <div className="text-xs text-gray-700">
              {data.revenueBreakdown.room.percentage > 85
                ? 'Diversify revenue by promoting laundry and other services to reduce dependency on room bookings.'
                : 'Good revenue diversification. Continue promoting all service lines.'}
            </div>
          </div>
        </div>

        {/* Weekday Analysis */}
        <div className="card">
          <SimpleBarChart
            data={data.weekdayAnalysis.byDay.map(d => ({
              label: d.day,
              value: d.avgRevenue,
              color: d.day === data.weekdayAnalysis.bestDay.day ? 'bg-green-500' : d.day === data.weekdayAnalysis.worstDay.day ? 'bg-red-400' : 'bg-blue-500',
            }))}
            title="Average Revenue by Day of Week"
          />
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <div className="text-xs text-gray-600 mb-1">📈 Strategy:</div>
            <div className="text-xs text-gray-700">
              {data.weekdayAnalysis.bestDay.day} is your strongest day. 
              Boost revenue on {data.weekdayAnalysis.worstDay.day} with targeted promotions and packages.
            </div>
          </div>
        </div>

        {/* Occupancy Correlation */}
        <div className="card">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Occupancy Rate Trend</h4>
          <div className="space-y-2">
            {data.occupancyData.slice(-14).map((occ, index) => (
              <div key={index}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-gray-600">{format(new Date(occ.date), 'MMM dd, EEE')}</span>
                  <span className="text-gray-900 font-semibold">{occ.rate.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      occ.rate > 75 ? 'bg-green-500' : occ.rate > 50 ? 'bg-blue-500' : 'bg-orange-500'
                    }`}
                    style={{ width: `${occ.rate}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <div className="text-xs text-gray-600 mb-1">🎯 Target:</div>
            <div className="text-xs text-gray-700">
              Maintain occupancy above 70% for optimal revenue. Green bars = excellent, blue = good, orange = needs attention.
            </div>
          </div>
        </div>
      </div>

      {/* Peak and Low Days */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Peak Days */}
        <div className="card bg-green-50 border-green-200">
          <h3 className="text-lg font-bold text-green-900 mb-4">🌟 Top Revenue Days</h3>
          <div className="space-y-3">
            {data.peakDays.map((day, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-white rounded-lg">
                <div>
                  <div className="font-semibold text-gray-900">{format(new Date(day.date), 'EEEE, MMM dd')}</div>
                  <div className="text-xs text-gray-500">{day.reason}</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-green-600">
                    ₦{day.revenue.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                  </div>
                  <div className="text-xs text-gray-500">#{index + 1} highest</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Low Days */}
        <div className="card bg-orange-50 border-orange-200">
          <h3 className="text-lg font-bold text-orange-900 mb-4">⚠️ Lowest Revenue Days</h3>
          <div className="space-y-3">
            {data.lowDays.map((day, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-white rounded-lg">
                <div>
                  <div className="font-semibold text-gray-900">{format(new Date(day.date), 'EEEE, MMM dd')}</div>
                  <div className="text-xs text-gray-500">{day.reason}</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-orange-600">
                    ₦{day.revenue.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                  </div>
                  <div className="text-xs text-gray-500">Needs improvement</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Action Recommendations */}
      <div className="card bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
        <h3 className="text-lg font-bold text-purple-900 mb-4 flex items-center">
          <Target className="w-5 h-5 mr-2" />
          Recommended Actions to Boost Revenue
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-white rounded-lg">
            <div className="font-semibold text-gray-900 mb-2">1. Dynamic Pricing Strategy</div>
            <div className="text-sm text-gray-700">
              Increase rates on {data.weekdayAnalysis.bestDay.day}s when demand is high. 
              Offer discounts on {data.weekdayAnalysis.worstDay.day}s to boost occupancy.
            </div>
          </div>
          
          {data.revenueBreakdown.laundry.percentage < 10 && (
            <div className="p-4 bg-white rounded-lg">
              <div className="font-semibold text-gray-900 mb-2">2. Promote Laundry Services</div>
              <div className="text-sm text-gray-700">
                Laundry revenue is only {data.revenueBreakdown.laundry.percentage.toFixed(1)}%. 
                Bundle laundry services with room bookings and offer express options.
              </div>
            </div>
          )}

          <div className="p-4 bg-white rounded-lg">
            <div className="font-semibold text-gray-900 mb-2">3. Weekend Packages</div>
            <div className="text-sm text-gray-700">
              Create attractive weekend getaway packages including meals and services to maximize weekend revenue.
            </div>
          </div>

          <div className="p-4 bg-white rounded-lg">
            <div className="font-semibold text-gray-900 mb-2">4. Corporate Partnerships</div>
            <div className="text-sm text-gray-700">
              Partner with local businesses for weekday bookings. Offer corporate rates and loyalty programs.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}