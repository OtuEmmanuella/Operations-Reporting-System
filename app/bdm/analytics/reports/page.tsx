'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { 
  ArrowLeft, Clock, CheckCircle, XCircle, AlertCircle, 
  FileText, TrendingUp, Target, Lightbulb, Package,
  DollarSign, Hotel, Users as UsersIcon, MessageSquare
} from 'lucide-react'
import { format, differenceInHours, subDays } from 'date-fns'
import Link from 'next/link'

interface ReportIntelligence {
  // Processing Metrics
  avgApprovalTime: number
  fastestApprovalTime: number
  slowestApprovalTime: number
  
  // Quality Metrics
  totalReports: number
  approvedReports: number
  rejectedReports: number
  clarificationReports: number
  approvalRate: number
  rejectionRate: number
  firstTimeApprovalRate: number
  
  // By Report Type
  byType: {
    type: string
    label: string
    icon: any
    total: number
    approved: number
    rejected: number
    avgTime: number
    approvalRate: number
  }[]
  
  // Trends
  reportsByDay: { date: string; total: number; approved: number; rejected: number }[]
  
  // Insights
  insights: ReportInsight[]
  recommendations: string[]
}

interface ReportInsight {
  id: string
  type: 'positive' | 'negative' | 'neutral'
  title: string
  description: string
}

export default function ReportIntelligencePage() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<ReportIntelligence | null>(null)
  const [dateRange, setDateRange] = useState<'7d' | '30d'>('30d')

  useEffect(() => {
    loadReportIntelligence()
  }, [dateRange])

  const loadReportIntelligence = async () => {
    setLoading(true)
    try {
      const days = dateRange === '7d' ? 7 : 30
      const startDate = format(subDays(new Date(), days), 'yyyy-MM-dd')
      const endDate = format(new Date(), 'yyyy-MM-dd')

      const allReports = await loadAllReports(startDate, endDate)

      // Calculate metrics
      const approvedReports = allReports.filter(r => r.status === 'approved')
      const rejectedReports = allReports.filter(r => r.status === 'rejected')
      const clarificationReports = allReports.filter(
        r => r.status === 'clarification_requested' || 
        (r.clarification_thread && r.clarification_thread.length > 0)
      )

      // Approval times
      const reportsWithTime = approvedReports.filter(r => r.reviewed_at && r.created_at)
      const approvalTimes = reportsWithTime.map(r => 
        differenceInHours(new Date(r.reviewed_at!), new Date(r.created_at))
      )
      const avgApprovalTime = approvalTimes.length > 0
        ? approvalTimes.reduce((sum, t) => sum + t, 0) / approvalTimes.length
        : 0
      const fastestApprovalTime = approvalTimes.length > 0 ? Math.min(...approvalTimes) : 0
      const slowestApprovalTime = approvalTimes.length > 0 ? Math.max(...approvalTimes) : 0

      // Quality rates
      const approvalRate = allReports.length > 0 
        ? (approvedReports.length / allReports.length) * 100 
        : 0
      const rejectionRate = allReports.length > 0
        ? (rejectedReports.length / allReports.length) * 100
        : 0
      
      const firstTimeApprovals = approvedReports.filter(
        r => !r.clarification_thread || r.clarification_thread.length === 0
      )
      const firstTimeApprovalRate = allReports.length > 0
        ? (firstTimeApprovals.length / allReports.length) * 100
        : 0

      // By type analysis
      const reportTypes = [
        { type: 'stock', label: 'Stock Reports', icon: Package },
        { type: 'sales', label: 'Sales Reports', icon: DollarSign },
        { type: 'expense', label: 'Expense Reports', icon: FileText },
        { type: 'occupancy', label: 'Occupancy Reports', icon: Hotel },
        { type: 'guest_activity', label: 'Guest Activity', icon: UsersIcon },
        { type: 'revenue', label: 'Revenue Reports', icon: TrendingUp },
        { type: 'complaint', label: 'Complaints', icon: MessageSquare },
      ]

      const byType = reportTypes.map(rt => {
        const typeReports = allReports.filter(r => r.type === rt.type)
        const typeApproved = typeReports.filter(r => r.status === 'approved')
        const typeRejected = typeReports.filter(r => r.status === 'rejected')
        
        const typeWithTime = typeApproved.filter(r => r.reviewed_at && r.created_at)
        const avgTime = typeWithTime.length > 0
          ? typeWithTime.reduce((sum, r) => sum + differenceInHours(new Date(r.reviewed_at!), new Date(r.created_at)), 0) / typeWithTime.length
          : 0

        return {
          type: rt.type,
          label: rt.label,
          icon: rt.icon,
          total: typeReports.length,
          approved: typeApproved.length,
          rejected: typeRejected.length,
          avgTime,
          approvalRate: typeReports.length > 0 ? (typeApproved.length / typeReports.length) * 100 : 0,
        }
      }).filter(t => t.total > 0)

      // Daily trend
      const reportsByDay = generateDailyTrend(allReports, days)

      // Generate insights
      const insights = generateInsights({
        avgApprovalTime,
        approvalRate,
        rejectionRate,
        firstTimeApprovalRate,
        clarificationRate: allReports.length > 0 ? (clarificationReports.length / allReports.length) * 100 : 0,
        byType,
      })

      const recommendations = generateRecommendations({
        avgApprovalTime,
        rejectionRate,
        firstTimeApprovalRate,
        byType,
      })

      setData({
        avgApprovalTime,
        fastestApprovalTime,
        slowestApprovalTime,
        totalReports: allReports.length,
        approvedReports: approvedReports.length,
        rejectedReports: rejectedReports.length,
        clarificationReports: clarificationReports.length,
        approvalRate,
        rejectionRate,
        firstTimeApprovalRate,
        byType,
        reportsByDay,
        insights,
        recommendations,
      })
    } catch (error) {
      console.error('Error loading report intelligence:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadAllReports = async (startDate: string, endDate: string) => {
    const tables = [
      { table: 'stock_reports', type: 'stock' },
      { table: 'sales_reports', type: 'sales' },
      { table: 'expense_reports', type: 'expense' },
      { table: 'occupancy_reports', type: 'occupancy' },
      { table: 'guest_activity_reports', type: 'guest_activity' },
      { table: 'revenue_reports', type: 'revenue' },
      { table: 'complaint_reports', type: 'complaint' },
    ]
    
    const results = await Promise.all(
      tables.map(({ table, type }) => 
        supabase
          .from(table as any)
          .select('*')
          .gte('report_date', startDate)
          .lte('report_date', endDate)
          .then(({ data }) => (data || []).map(r => ({ ...r, type })))
      )
    )
    
    return results.flat()
  }

  const generateDailyTrend = (reports: any[], days: number) => {
    const trend: { date: string; total: number; approved: number; rejected: number }[] = []
    
    for (let i = days - 1; i >= 0; i--) {
      const date = format(subDays(new Date(), i), 'yyyy-MM-dd')
      const dayReports = reports.filter(r => r.report_date === date)
      
      trend.push({
        date,
        total: dayReports.length,
        approved: dayReports.filter(r => r.status === 'approved').length,
        rejected: dayReports.filter(r => r.status === 'rejected').length,
      })
    }
    
    return trend
  }

  const generateInsights = (metrics: any): ReportInsight[] => {
    const insights: ReportInsight[] = []

    // Approval time insight
    if (metrics.avgApprovalTime < 12) {
      insights.push({
        id: '1',
        type: 'positive',
        title: 'Fast Processing Time',
        description: `Reports are reviewed in ${metrics.avgApprovalTime.toFixed(1)} hours on average. This quick turnaround keeps managers productive.`,
      })
    } else if (metrics.avgApprovalTime > 48) {
      insights.push({
        id: '2',
        type: 'negative',
        title: 'Slow Review Process',
        description: `Average approval time of ${(metrics.avgApprovalTime / 24).toFixed(1)} days is too long. Managers are waiting for feedback.`,
      })
    }

    // Quality insight
    if (metrics.firstTimeApprovalRate > 80) {
      insights.push({
        id: '3',
        type: 'positive',
        title: 'High Quality Submissions',
        description: `${metrics.firstTimeApprovalRate.toFixed(0)}% of reports are approved without clarification or rejection. Managers understand requirements well.`,
      })
    } else if (metrics.firstTimeApprovalRate < 50) {
      insights.push({
        id: '4',
        type: 'negative',
        title: 'Quality Issues Detected',
        description: `Only ${metrics.firstTimeApprovalRate.toFixed(0)}% of reports are approved on first submission. Consider training on report standards.`,
      })
    }

    // Rejection rate
    if (metrics.rejectionRate > 15) {
      insights.push({
        id: '5',
        type: 'negative',
        title: 'High Rejection Rate',
        description: `${metrics.rejectionRate.toFixed(1)}% rejection rate indicates systemic quality issues. Review common rejection reasons and provide guidance.`,
      })
    }

    // Type-specific insights
    const problemTypes = metrics.byType.filter((t: any) => t.approvalRate < 70)
    if (problemTypes.length > 0) {
      insights.push({
        id: '6',
        type: 'neutral',
        title: 'Report Type Issues',
        description: `${problemTypes.map((t: any) => t.label).join(', ')} have lower approval rates. Focus coaching on these specific report types.`,
      })
    }

    return insights
  }

  const generateRecommendations = (metrics: any): string[] => {
    const recs: string[] = []

    if (metrics.avgApprovalTime > 24) {
      recs.push('Set a 24-hour SLA for report reviews to improve manager satisfaction and workflow efficiency.')
    }

    if (metrics.rejectionRate > 10) {
      recs.push('Create a report quality checklist and share common rejection reasons with managers.')
    }

    if (metrics.firstTimeApprovalRate < 70) {
      recs.push('Conduct monthly training sessions on report standards and best practices.')
    }

    const slowTypes = metrics.byType.filter((t: any) => t.avgTime > 36)
    if (slowTypes.length > 0) {
      recs.push(`Prioritize ${slowTypes.map((t: any) => t.label).join(', ')} for faster processing—these currently take over 36 hours.`)
    }

    if (recs.length === 0) {
      recs.push('Excellent report processing performance! Maintain current standards.')
    }

    return recs
  }

  const formatHours = (hours: number) => {
    if (hours < 1) return `${Math.round(hours * 60)}m`
    if (hours < 24) return `${hours.toFixed(1)}h`
    return `${Math.floor(hours / 24)}d ${Math.round(hours % 24)}h`
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-lg text-gray-600">Analyzing report intelligence...</div>
        </div>
      </div>
    )
  }

  if (!data) return <div className="p-8 text-red-600">Failed to load data</div>

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
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Report Intelligence</h1>
            <p className="text-gray-600">Processing times, quality metrics, and optimization opportunities</p>
          </div>

          {/* Date Range */}
          <div className="flex items-center space-x-2">
            {[
              { value: '7d' as const, label: 'Last 7 Days' },
              { value: '30d' as const, label: 'Last 30 Days' },
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

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="card">
          <div className="text-sm text-gray-600 mb-1">Avg Approval Time</div>
          <div className="text-3xl font-bold text-gray-900">{formatHours(data.avgApprovalTime)}</div>
          <div className="text-xs text-gray-500 mt-1">
            Fastest: {formatHours(data.fastestApprovalTime)}
          </div>
        </div>

        <div className="card">
          <div className="text-sm text-gray-600 mb-1">Approval Rate</div>
          <div className="text-3xl font-bold text-green-600">{data.approvalRate.toFixed(1)}%</div>
          <div className="text-xs text-gray-500 mt-1">
            {data.approvedReports} of {data.totalReports}
          </div>
        </div>

        <div className="card">
          <div className="text-sm text-gray-600 mb-1">First-Time Approval</div>
          <div className="text-3xl font-bold text-blue-600">{data.firstTimeApprovalRate.toFixed(1)}%</div>
          <div className="text-xs text-gray-500 mt-1">No clarifications needed</div>
        </div>

        <div className="card">
          <div className="text-sm text-gray-600 mb-1">Rejection Rate</div>
          <div className="text-3xl font-bold text-red-600">{data.rejectionRate.toFixed(1)}%</div>
          <div className="text-xs text-gray-500 mt-1">
            {data.rejectedReports} rejected
          </div>
        </div>
      </div>

      {/* Insights */}
      {data.insights.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
            <Lightbulb className="w-5 h-5 text-yellow-500 mr-2" />
            Key Insights
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.insights.map(insight => (
              <div
                key={insight.id}
                className={`p-4 rounded-xl border-l-4 ${
                  insight.type === 'positive' ? 'bg-green-50 border-green-500' :
                  insight.type === 'negative' ? 'bg-red-50 border-red-500' :
                  'bg-blue-50 border-blue-500'
                }`}
              >
                <div className={`font-semibold mb-1 ${
                  insight.type === 'positive' ? 'text-green-900' :
                  insight.type === 'negative' ? 'text-red-900' :
                  'text-blue-900'
                }`}>
                  {insight.title}
                </div>
                <div className={`text-sm ${
                  insight.type === 'positive' ? 'text-green-700' :
                  insight.type === 'negative' ? 'text-red-700' :
                  'text-blue-700'
                }`}>
                  {insight.description}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* By Report Type */}
      <div className="mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Performance by Report Type</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.byType.map(type => {
            const Icon = type.icon
            return (
              <div key={type.type} className="card">
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">{type.label}</div>
                    <div className="text-xs text-gray-500">{type.total} reports</div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-xs text-gray-500">Approval Rate</div>
                    <div className={`font-bold ${
                      type.approvalRate >= 80 ? 'text-green-600' :
                      type.approvalRate >= 60 ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {type.approvalRate.toFixed(0)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Avg Time</div>
                    <div className="font-bold text-gray-900">{formatHours(type.avgTime)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Approved</div>
                    <div className="font-semibold text-green-600">{type.approved}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Rejected</div>
                    <div className="font-semibold text-red-600">{type.rejected}</div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Daily Trend */}
      <div className="mb-8 card">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Daily Report Processing Trend</h3>
        <div className="space-y-2">
          {data.reportsByDay.slice(-14).map((day, index) => (
            <div key={index}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-gray-600">{format(new Date(day.date), 'MMM dd, EEE')}</span>
                <div className="flex items-center space-x-3">
                  <span className="text-green-600 font-semibold">{day.approved} ✓</span>
                  <span className="text-red-600 font-semibold">{day.rejected} ✗</span>
                  <span className="text-gray-900 font-bold">{day.total} total</span>
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 flex overflow-hidden">
                <div 
                  className="bg-green-500 h-2"
                  style={{ width: `${day.total > 0 ? (day.approved / day.total) * 100 : 0}%` }}
                />
                <div 
                  className="bg-red-500 h-2"
                  style={{ width: `${day.total > 0 ? (day.rejected / day.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <div className="text-xs text-gray-600 mb-1">📊 What this shows:</div>
          <div className="text-xs text-gray-700">
            Green = approved reports, Red = rejected reports. 
            Consistent green bars indicate stable quality. Spikes in red suggest training needs.
          </div>
        </div>
      </div>

      {/* Recommendations */}
      <div className="card bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
        <h3 className="text-lg font-bold text-purple-900 mb-4 flex items-center">
          <Target className="w-5 h-5 mr-2" />
          Recommended Actions
        </h3>
        <ul className="space-y-2">
          {data.recommendations.map((rec, index) => (
            <li key={index} className="flex items-start p-3 bg-white rounded-lg">
              <CheckCircle className="w-5 h-5 text-purple-600 mr-3 mt-0.5 flex-shrink-0" />
              <span className="text-sm text-gray-700">{rec}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}