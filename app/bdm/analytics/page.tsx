'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { 
  TrendingUp, TrendingDown, DollarSign, Hotel, Users, Clock, 
  AlertCircle, ArrowRight, Lightbulb, Target, Award, Zap, 
  Calendar, ChevronDown, Info, CheckCircle, XCircle
} from 'lucide-react'
import { format, subDays, startOfMonth, endOfMonth, differenceInHours } from 'date-fns'
import Link from 'next/link'

interface DashboardData {
  // Core KPIs
  totalRevenue: number
  revenueGrowth: number
  avgOccupancy: number
  occupancyTrend: number
  adr: number
  revpar: number
  
  // Manager Performance
  managerCompliance: number
  avgApprovalTime: number
  rejectionRate: number
  topPerformerName: string
  topPerformerScore: number
  
  // Alerts & Insights
  criticalAlerts: Alert[]
  smartInsights: Insight[]
  recommendations: Recommendation[]
  
  // Quick Stats
  totalReports: number
  pendingReports: number
  complaintsToday: number
}

interface Alert {
  id: string
  type: 'critical' | 'warning' | 'info'
  title: string
  message: string
  action?: string
  actionLink?: string
}

interface Insight {
  id: string
  icon: any
  title: string
  description: string
  impact: 'positive' | 'negative' | 'neutral'
}

interface Recommendation {
  id: string
  category: string
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
  actionLink?: string
}

export default function AnalyticsDashboard() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<DashboardData | null>(null)
  const [dateRange, setDateRange] = useState<'today' | '7d' | '30d'>('7d')
  const [showTooltip, setShowTooltip] = useState<string | null>(null)

  useEffect(() => {
    loadDashboard()
  }, [dateRange])

  const loadDashboard = async () => {
    setLoading(true)
    try {
      const { start, end } = getDateRange()
      const startDate = format(start, 'yyyy-MM-dd')
      const endDate = format(end, 'yyyy-MM-dd')

      // Load all data in parallel
      const [managers, revenues, occupancies, allReports, complaints] = await Promise.all([
        supabase.from('users').select('*').in('role', ['manager', 'front_office_manager']),
        supabase.from('revenue_reports').select('*').gte('report_date', startDate).lte('report_date', endDate),
        supabase.from('occupancy_reports').select('*').gte('report_date', startDate).lte('report_date', endDate),
        loadAllReports(startDate, endDate),
        supabase.from('complaint_reports').select('*').eq('report_date', format(new Date(), 'yyyy-MM-dd')),
      ])

      // Calculate KPIs
      const kpis = calculateKPIs(
        revenues.data || [],
        occupancies.data || [],
        allReports,
        managers.data || []
      )

      // Generate insights and recommendations
      const insights = generateInsights(kpis, revenues.data || [], occupancies.data || [])
      const recommendations = generateRecommendations(kpis)
      const alerts = generateAlerts(kpis, complaints.data || [])

      setData({
        ...kpis,
        criticalAlerts: alerts,
        smartInsights: insights,
        recommendations,
        totalReports: allReports.length,
        pendingReports: allReports.filter(r => r.status === 'pending').length,
        complaintsToday: complaints.data?.length || 0,
      })
    } catch (error) {
      console.error('Error loading dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  const getDateRange = () => {
    const today = new Date()
    switch (dateRange) {
      case 'today': return { start: today, end: today }
      case '7d': return { start: subDays(today, 7), end: today }
      case '30d': return { start: subDays(today, 30), end: today }
    }
  }

  const loadAllReports = async (startDate: string, endDate: string) => {
  const tables = [
    'stock_inventory_reports',  // NEW: unified stock + inventory
    'sales_reports',
    'occupancy_reports',
    'guest_activity_reports',
    'revenue_reports',
    'complaint_reports'
  ]
  
  const results = await Promise.all(
    tables.map(table => 
      supabase
        .from(table as any)
        .select('*')
        .gte('report_date', startDate)
        .lte('report_date', endDate)
        .then(({ data }) => data || [])
    )
  )
  
  return results.flat()
}

  const calculateKPIs = (revenues: any[], occupancies: any[], reports: any[], managers: any[]) => {
    // Revenue metrics
    const totalRevenue = revenues.reduce((sum, r) => sum + (r.total_revenue || 0), 0)
    const prevPeriodRevenues = revenues.filter(r => {
      const days = dateRange === 'today' ? 1 : dateRange === '7d' ? 7 : 30
      const d = new Date(r.report_date)
      return d < subDays(new Date(), days)
    })
    const prevRevenue = prevPeriodRevenues.reduce((sum, r) => sum + (r.total_revenue || 0), 0)
    const revenueGrowth = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0

    // Occupancy metrics
    const avgOccupancy = occupancies.length > 0
      ? occupancies.reduce((sum, o) => sum + o.occupancy_percentage, 0) / occupancies.length
      : 0
    const recentOcc = occupancies.slice(-3)
    const earlierOcc = occupancies.slice(0, 3)
    const recentAvg = recentOcc.length > 0 ? recentOcc.reduce((s, o) => s + o.occupancy_percentage, 0) / recentOcc.length : 0
    const earlierAvg = earlierOcc.length > 0 ? earlierOcc.reduce((s, o) => s + o.occupancy_percentage, 0) / earlierOcc.length : 0
    const occupancyTrend = earlierAvg > 0 ? ((recentAvg - earlierAvg) / earlierAvg) * 100 : 0

    // Hotel KPIs
    const totalRoomRevenue = revenues.reduce((sum, r) => sum + (r.room_revenue || 0), 0)
    const totalRoomNights = occupancies.reduce((sum, o) => sum + (o.occupied_rooms || 0), 0)
    const adr = totalRoomNights > 0 ? totalRoomRevenue / totalRoomNights : 0
    
    const totalAvailableRooms = occupancies.reduce((sum, o) => sum + (o.total_rooms || 0), 0)
    const revpar = totalAvailableRooms > 0 ? totalRevenue / totalAvailableRooms : 0

    // Manager performance
    const today = format(new Date(), 'yyyy-MM-dd')
    const activeToday = managers.filter(m => reports.some(r => r.manager_id === m.id && r.report_date === today)).length
    const managerCompliance = managers.length > 0 ? (activeToday / managers.length) * 100 : 0

    // Report metrics
    const approvedReports = reports.filter(r => r.status === 'approved' && r.reviewed_at && r.created_at)
    const avgApprovalTime = approvedReports.length > 0
      ? approvedReports.reduce((sum, r) => sum + differenceInHours(new Date(r.reviewed_at), new Date(r.created_at)), 0) / approvedReports.length
      : 0
    
    const rejectionRate = reports.length > 0
      ? (reports.filter(r => r.status === 'rejected').length / reports.length) * 100
      : 0

    // Top performer
    const managerScores = managers.map(m => {
      const managerReports = reports.filter(r => r.manager_id === m.id)
      const approved = managerReports.filter(r => r.status === 'approved').length
      const score = managerReports.length > 0 ? (approved / managerReports.length) * 100 : 0
      return { name: m.full_name, score }
    }).sort((a, b) => b.score - a.score)

    return {
      totalRevenue,
      revenueGrowth,
      avgOccupancy,
      occupancyTrend,
      adr,
      revpar,
      managerCompliance,
      avgApprovalTime,
      rejectionRate,
      topPerformerName: managerScores[0]?.name || 'N/A',
      topPerformerScore: managerScores[0]?.score || 0,
    }
  }

  const generateInsights = (kpis: any, revenues: any[], occupancies: any[]): Insight[] => {
    const insights: Insight[] = []

    // Revenue insight
    if (kpis.revenueGrowth > 10) {
      insights.push({
        id: '1',
        icon: TrendingUp,
        title: 'Strong Revenue Growth',
        description: `Revenue increased by ${kpis.revenueGrowth.toFixed(1)}% compared to the previous period. This indicates healthy business momentum.`,
        impact: 'positive',
      })
    } else if (kpis.revenueGrowth < -5) {
      insights.push({
        id: '2',
        icon: TrendingDown,
        title: 'Revenue Declining',
        description: `Revenue decreased by ${Math.abs(kpis.revenueGrowth).toFixed(1)}%. Consider reviewing pricing strategy and promotional activities.`,
        impact: 'negative',
      })
    }

    // Occupancy insight
    if (kpis.avgOccupancy > 75) {
      insights.push({
        id: '3',
        icon: Hotel,
        title: 'High Occupancy Rate',
        description: `Average occupancy at ${kpis.avgOccupancy.toFixed(1)}% suggests strong demand. Consider dynamic pricing to maximize revenue.`,
        impact: 'positive',
      })
    } else if (kpis.avgOccupancy < 50) {
      insights.push({
        id: '4',
        icon: AlertCircle,
        title: 'Low Occupancy',
        description: `Occupancy at ${kpis.avgOccupancy.toFixed(1)}% is below optimal. Focus on marketing and promotional campaigns.`,
        impact: 'negative',
      })
    }

    // Manager compliance
    if (kpis.managerCompliance < 80) {
      insights.push({
        id: '5',
        icon: Users,
        title: 'Report Submission Gaps',
        description: `Only ${kpis.managerCompliance.toFixed(0)}% of managers submitted reports today. Follow up with inactive managers.`,
        impact: 'negative',
      })
    }

    return insights
  }

  const generateRecommendations = (kpis: any): Recommendation[] => {
    const recs: Recommendation[] = []

    // Revenue recommendations
    if (kpis.adr < 15000) {
      recs.push({
        id: '1',
        category: 'Revenue',
        title: 'Increase Average Daily Rate',
        description: `Your ADR (₦${kpis.adr.toFixed(0)}) is below industry standards. Consider value-added packages, room upgrades, and seasonal pricing.`,
        priority: 'high',
        actionLink: '/bdm/analytics/revenue',
      })
    }

    if (kpis.rejectionRate > 15) {
      recs.push({
        id: '2',
        category: 'Operations',
        title: 'Reduce Report Rejection Rate',
        description: `${kpis.rejectionRate.toFixed(1)}% of reports are rejected. Conduct training sessions on report quality and accuracy.`,
        priority: 'high',
        actionLink: '/bdm/analytics/reports',
      })
    }

    if (kpis.avgApprovalTime > 24) {
      recs.push({
        id: '3',
        category: 'Efficiency',
        title: 'Speed Up Report Processing',
        description: `Average approval time is ${(kpis.avgApprovalTime / 24).toFixed(1)} days. Set SLA targets and streamline review workflows.`,
        priority: 'medium',
        actionLink: '/bdm/analytics/reports',
      })
    }

    if (kpis.avgOccupancy < 60) {
      recs.push({
        id: '4',
        category: 'Marketing',
        title: 'Boost Room Occupancy',
        description: 'Launch targeted campaigns on social media, partner with travel agencies, and offer weekend packages.',
        priority: 'high',
      })
    }

    return recs
  }

  const generateAlerts = (kpis: any, complaints: any[]): Alert[] => {
    const alerts: Alert[] = []

    const criticalComplaints = complaints.filter(c => c.severity === 'critical')
    if (criticalComplaints.length > 0) {
      alerts.push({
        id: '1',
        type: 'critical',
        title: 'Critical Guest Complaints',
        message: `${criticalComplaints.length} critical complaint${criticalComplaints.length > 1 ? 's' : ''} logged today requiring immediate attention.`,
        action: 'View Complaints',
        actionLink: '/front-office/complaints',
      })
    }

    if (kpis.managerCompliance < 70) {
      alerts.push({
        id: '2',
        type: 'warning',
        title: 'Low Report Submission',
        message: `${(100 - kpis.managerCompliance).toFixed(0)}% of managers haven't submitted today's reports.`,
        action: 'Contact Managers',
        actionLink: '/bdm/managers',
      })
    }

    if (kpis.rejectionRate > 20) {
      alerts.push({
        id: '3',
        type: 'warning',
        title: 'High Rejection Rate',
        message: 'More than 20% of reports are being rejected. Quality issues detected.',
        action: 'Review Reports',
        actionLink: '/bdm/rejected',
      })
    }

    return alerts
  }

  const Tooltip = ({ content }: { content: string }) => (
    <div className="absolute z-10 px-3 py-2 text-xs text-white bg-gray-900 rounded-lg shadow-lg max-w-xs -top-2 left-full ml-2 whitespace-normal">
      {content}
      <div className="absolute top-3 -left-1 w-2 h-2 bg-gray-900 transform rotate-45"></div>
    </div>
  )

  const KPICard = ({ 
    title, 
    value, 
    trend, 
    icon: Icon, 
    color, 
    tooltip,
    link 
  }: {
    title: string
    value: string
    trend?: number
    icon: any
    color: string
    tooltip: string
    link?: string
  }) => {
    const [showTip, setShowTip] = useState(false)
    
    const card = (
      <div className={`card ${link ? 'hover:shadow-lg cursor-pointer transition-all' : ''}`}>
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-2">
              <span className="text-sm font-medium text-gray-600">{title}</span>
              <div 
                className="relative"
                onMouseEnter={() => setShowTip(true)}
                onMouseLeave={() => setShowTip(false)}
              >
                <Info className="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help" />
                {showTip && <Tooltip content={tooltip} />}
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900">{value}</div>
          </div>
          <div className={`w-12 h-12 ${color} rounded-xl flex items-center justify-center flex-shrink-0`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
        </div>
        {trend !== undefined && (
          <div className="flex items-center space-x-2">
            {trend > 0 ? (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                <TrendingUp className="w-3 h-3 mr-1" />
                {trend.toFixed(1)}%
              </span>
            ) : trend < 0 ? (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                <TrendingDown className="w-3 h-3 mr-1" />
                {Math.abs(trend).toFixed(1)}%
              </span>
            ) : (
              <span className="text-xs text-gray-500">No change</span>
            )}
            <span className="text-xs text-gray-500">vs previous period</span>
          </div>
        )}
      </div>
    )

    return link ? <Link href={link}>{card}</Link> : card
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-lg text-gray-600">Loading analytics...</div>
        </div>
      </div>
    )
  }

  if (!data) return <div className="p-8 text-red-600">Failed to load analytics</div>

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Analytics Dashboard</h1>
        <p className="text-gray-600">Intelligent insights to optimize hotel performance</p>
      </div>

      {/* Date Range Selector */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          {[
            { value: 'today' as const, label: 'Today' },
            { value: '7d' as const, label: 'Last 7 Days' },
            { value: '30d' as const, label: 'Last 30 Days' },
          ].map(option => (
            <button
              key={option.value}
              onClick={() => setDateRange(option.value)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                dateRange === option.value
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Critical Alerts */}
      {data.criticalAlerts.length > 0 && (
        <div className="mb-8 space-y-3">
          {data.criticalAlerts.map(alert => (
            <div
              key={alert.id}
              className={`p-4 rounded-xl border-l-4 ${
                alert.type === 'critical'
                  ? 'bg-red-50 border-red-500'
                  : alert.type === 'warning'
                  ? 'bg-orange-50 border-orange-500'
                  : 'bg-blue-50 border-blue-500'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3 flex-1">
                  <AlertCircle className={`w-5 h-5 mt-0.5 ${
                    alert.type === 'critical' ? 'text-red-600' : alert.type === 'warning' ? 'text-orange-600' : 'text-blue-600'
                  }`} />
                  <div>
                    <div className={`font-semibold mb-1 ${
                      alert.type === 'critical' ? 'text-red-900' : alert.type === 'warning' ? 'text-orange-900' : 'text-blue-900'
                    }`}>
                      {alert.title}
                    </div>
                    <div className={`text-sm ${
                      alert.type === 'critical' ? 'text-red-700' : alert.type === 'warning' ? 'text-orange-700' : 'text-blue-700'
                    }`}>
                      {alert.message}
                    </div>
                  </div>
                </div>
                {alert.actionLink && (
                  <Link
                    href={alert.actionLink}
                    className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors flex-shrink-0 ${
                      alert.type === 'critical'
                        ? 'bg-red-600 text-white hover:bg-red-700'
                        : alert.type === 'warning'
                        ? 'bg-orange-600 text-white hover:bg-orange-700'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {alert.action}
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <KPICard
          title="Total Revenue"
          value={`₦${data.totalRevenue.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`}
          trend={data.revenueGrowth}
          icon={DollarSign}
          color="bg-green-500"
          tooltip="Total revenue generated from all sources including rooms, laundry, and other services"
          link="/bdm/analytics/revenue"
        />
        
        <KPICard
          title="Occupancy Rate"
          value={`${data.avgOccupancy.toFixed(1)}%`}
          trend={data.occupancyTrend}
          icon={Hotel}
          color="bg-blue-500"
          tooltip="Percentage of available rooms that are occupied. Industry standard: 60-70%"
          link="/bdm/analytics/revenue"
        />
        
        <KPICard
          title="ADR (Avg Daily Rate)"
          value={`₦${data.adr.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`}
          icon={Target}
          color="bg-purple-500"
          tooltip="Average revenue earned per occupied room. Higher ADR indicates better pricing power"
          link="/bdm/analytics/revenue"
        />
        
        <KPICard
          title="RevPAR"
          value={`₦${data.revpar.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`}
          icon={TrendingUp}
          color="bg-indigo-500"
          tooltip="Revenue Per Available Room - combines occupancy and ADR to show overall room revenue performance"
          link="/bdm/analytics/revenue"
        />
        
        <KPICard
          title="Manager Compliance"
          value={`${data.managerCompliance.toFixed(0)}%`}
          icon={Users}
          color="bg-cyan-500"
          tooltip="Percentage of managers who submitted all required reports on time"
          link="/bdm/analytics/managers"
        />
        
        <KPICard
          title="Report Quality"
          value={`${(100 - data.rejectionRate).toFixed(0)}%`}
          icon={CheckCircle}
          color="bg-emerald-500"
          tooltip="Percentage of reports approved without rejection. Target: >90%"
          link="/bdm/analytics/reports"
        />
      </div>

      {/* Smart Insights */}
      {data.smartInsights.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center space-x-2 mb-4">
            <Lightbulb className="w-5 h-5 text-yellow-500" />
            <h2 className="text-xl font-bold text-gray-900">Smart Insights</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.smartInsights.map(insight => {
              const Icon = insight.icon
              return (
                <div
                  key={insight.id}
                  className={`p-4 rounded-xl border-2 ${
                    insight.impact === 'positive'
                      ? 'bg-green-50 border-green-200'
                      : insight.impact === 'negative'
                      ? 'bg-orange-50 border-orange-200'
                      : 'bg-blue-50 border-blue-200'
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      insight.impact === 'positive' ? 'bg-green-500' : insight.impact === 'negative' ? 'bg-orange-500' : 'bg-blue-500'
                    }`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className={`font-semibold mb-1 ${
                        insight.impact === 'positive' ? 'text-green-900' : insight.impact === 'negative' ? 'text-orange-900' : 'text-blue-900'
                      }`}>
                        {insight.title}
                      </div>
                      <div className={`text-sm ${
                        insight.impact === 'positive' ? 'text-green-700' : insight.impact === 'negative' ? 'text-orange-700' : 'text-blue-700'
                      }`}>
                        {insight.description}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {data.recommendations.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center space-x-2 mb-4">
            <Zap className="w-5 h-5 text-orange-500" />
            <h2 className="text-xl font-bold text-gray-900">Recommended Actions</h2>
          </div>
          <div className="space-y-3">
            {data.recommendations.map(rec => (
              <div
                key={rec.id}
                className={`p-4 rounded-xl border-l-4 ${
                  rec.priority === 'high'
                    ? 'bg-red-50 border-red-500'
                    : rec.priority === 'medium'
                    ? 'bg-yellow-50 border-yellow-500'
                    : 'bg-blue-50 border-blue-500'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        rec.priority === 'high' ? 'bg-red-100 text-red-700' : rec.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {rec.category}
                      </span>
                      <span className={`font-semibold ${
                        rec.priority === 'high' ? 'text-red-900' : rec.priority === 'medium' ? 'text-yellow-900' : 'text-blue-900'
                      }`}>
                        {rec.title}
                      </span>
                    </div>
                    <div className={`text-sm ${
                      rec.priority === 'high' ? 'text-red-700' : rec.priority === 'medium' ? 'text-yellow-700' : 'text-blue-700'
                    }`}>
                      {rec.description}
                    </div>
                  </div>
                  {rec.actionLink && (
                    <Link
                      href={rec.actionLink}
                      className="ml-4 px-4 py-2 bg-gray-900 text-white rounded-lg font-medium text-sm hover:bg-gray-800 transition-colors flex items-center space-x-1 flex-shrink-0"
                    >
                      <span>View Details</span>
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link href="/bdm/analytics/revenue" className="card hover:shadow-lg transition-all">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <div className="font-semibold text-gray-900">Revenue Analytics</div>
              <div className="text-sm text-gray-600">Trends, charts & forecasts</div>
            </div>
            <ArrowRight className="w-5 h-5 text-gray-400" />
          </div>
        </Link>

        <Link href="/bdm/analytics/managers" className="card hover:shadow-lg transition-all">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center">
              <Award className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <div className="font-semibold text-gray-900">Manager Performance</div>
              <div className="text-sm text-gray-600">Leaderboard & coaching</div>
            </div>
            <ArrowRight className="w-5 h-5 text-gray-400" />
          </div>
        </Link>

        <Link href="/bdm/analytics/reports" className="card hover:shadow-lg transition-all">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-purple-500 rounded-xl flex items-center justify-center">
              <Clock className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <div className="font-semibold text-gray-900">Report Intelligence</div>
              <div className="text-sm text-gray-600">Quality & processing times</div>
            </div>
            <ArrowRight className="w-5 h-5 text-gray-400" />
          </div>
        </Link>
      </div>
    </div>
  )
}