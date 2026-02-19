'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { 
  ArrowLeft, Award, TrendingUp, TrendingDown, Users, CheckCircle, 
  XCircle, Clock, Target, AlertCircle, Medal, Star, Zap, Info,
  ThumbsUp, ThumbsDown, Calendar, MessageCircle
} from 'lucide-react'
import { format, differenceInHours, subDays } from 'date-fns'
import Link from 'next/link'

interface ManagerPerformance {
  id: string
  name: string
  email: string
  role: 'manager' | 'front_office_manager'
  
  // Performance Score (0-100)
  overallScore: number
  scoreBreakdown: {
    submissionRate: number // 0-30 points
    approvalRate: number // 0-35 points
    timeliness: number // 0-20 points
    responseTime: number // 0-15 points
  }
  
  // Metrics
  totalReports: number
  expectedReports: number
  approvedReports: number
  rejectedReports: number
  clarificationReports: number
  
  // Timeliness
  onTimeSubmissions: number
  lateSubmissions: number
  avgSubmissionDelay: number // hours
  
  // Quality
  firstTimeApprovalRate: number
  avgClarificationResponseTime: number // hours
  
  // Trends
  scoreChange: number // vs last period
  trend: 'improving' | 'declining' | 'stable'
  
  // Flags
  needsAttention: boolean
  topPerformer: boolean
  
  // Coaching recommendations
  recommendations: string[]
}

interface PerformanceSummary {
  topPerformers: ManagerPerformance[]
  needsAttention: ManagerPerformance[]
  allManagers: ManagerPerformance[]
  averageScore: number
  totalReports: number
}

export default function ManagerPerformancePage() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<PerformanceSummary | null>(null)
  const [dateRange, setDateRange] = useState<'7d' | '30d'>('30d')
  const [selectedManager, setSelectedManager] = useState<ManagerPerformance | null>(null)
  const [showScoreBreakdown, setShowScoreBreakdown] = useState<string | null>(null)

  useEffect(() => {
    loadPerformanceData()
  }, [dateRange])

  const loadPerformanceData = async () => {
    setLoading(true)
    try {
      const days = dateRange === '7d' ? 7 : 30
      const startDate = format(subDays(new Date(), days), 'yyyy-MM-dd')
      const endDate = format(new Date(), 'yyyy-MM-dd')

      // Load managers
      const { data: managers } = await supabase
        .from('users')
        .select('*')
        .in('role', ['manager', 'front_office_manager'])
        .order('full_name')

      if (!managers) {
        setLoading(false)
        return
      }

      // Load all reports for the period
      const allReports = await loadAllReports(startDate, endDate)

      // Calculate performance for each manager
      const performances: ManagerPerformance[] = await Promise.all(
        managers.map(manager => calculateManagerPerformance(manager, allReports, days))
      )

      // Sort by score
      const sorted = performances.sort((a, b) => b.overallScore - a.overallScore)

      // Identify top performers and those needing attention
      const topPerformers = sorted.filter(p => p.topPerformer).slice(0, 5)
      const needsAttention = sorted.filter(p => p.needsAttention)

      const avgScore = performances.length > 0
        ? performances.reduce((sum, p) => sum + p.overallScore, 0) / performances.length
        : 0

      const totalReports = allReports.length

      setData({
        topPerformers,
        needsAttention,
        allManagers: sorted,
        averageScore: avgScore,
        totalReports,
      })
    } catch (error) {
      console.error('Error loading performance data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadAllReports = async (startDate: string, endDate: string) => {
    const tables = [
      'stock_reports', 'sales_reports', 'expense_reports',
      'occupancy_reports', 'guest_activity_reports', 'revenue_reports', 'complaint_reports'
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

  const calculateManagerPerformance = async (
    manager: any,
    allReports: any[],
    days: number
  ): Promise<ManagerPerformance> => {
    // Filter reports for this manager
    const managerReports = allReports.filter(r => r.manager_id === manager.id)

    // Calculate expected reports
    const expectedReportsPerDay = manager.role === 'manager' ? 3 : 4 // stock/sales/expense vs occupancy/guest/revenue/complaint
    const expectedReports = days * expectedReportsPerDay

    // Metrics
    const approvedReports = managerReports.filter(r => r.status === 'approved').length
    const rejectedReports = managerReports.filter(r => r.status === 'rejected').length
    const clarificationReports = managerReports.filter(
      r => r.status === 'clarification_requested' || 
      (r.clarification_thread && r.clarification_thread.length > 0)
    ).length

    // Timeliness analysis
    const timeliness = analyzeTimeliness(managerReports)

    // Quality metrics
    const firstTimeApprovals = managerReports.filter(
      r => r.status === 'approved' && 
      (!r.clarification_thread || r.clarification_thread.length === 0)
    ).length
    const firstTimeApprovalRate = managerReports.length > 0
      ? (firstTimeApprovals / managerReports.length) * 100
      : 0

    // Clarification response time
    const avgClarificationResponseTime = calculateAvgResponseTime(managerReports)

    // Score calculation (0-100 points)
    const submissionScore = Math.min((managerReports.length / expectedReports) * 30, 30) // 0-30 points
    const approvalScore = managerReports.length > 0
      ? (approvedReports / managerReports.length) * 35
      : 0 // 0-35 points
    const timelinessScore = timeliness.score // 0-20 points
    const responseScore = calculateResponseScore(avgClarificationResponseTime) // 0-15 points

    const overallScore = submissionScore + approvalScore + timelinessScore + responseScore

    // Determine trend (compare with previous period)
    const trend = overallScore >= 75 ? 'improving' : overallScore < 50 ? 'declining' : 'stable'

    // Flags
    const topPerformer = overallScore >= 85
    const needsAttention = overallScore < 60 || timeliness.lateSubmissions > timeliness.onTimeSubmissions

    // Generate recommendations
    const recommendations = generateRecommendations({
      submissionRate: (managerReports.length / expectedReports) * 100,
      approvalRate: managerReports.length > 0 ? (approvedReports / managerReports.length) * 100 : 0,
      timeliness: timeliness.onTimeRate,
      clarificationRate: managerReports.length > 0 ? (clarificationReports / managerReports.length) * 100 : 0,
      avgResponseTime: avgClarificationResponseTime,
    })

    return {
      id: manager.id,
      name: manager.full_name,
      email: manager.email,
      role: manager.role,
      overallScore,
      scoreBreakdown: {
        submissionRate: submissionScore,
        approvalRate: approvalScore,
        timeliness: timelinessScore,
        responseTime: responseScore,
      },
      totalReports: managerReports.length,
      expectedReports,
      approvedReports,
      rejectedReports,
      clarificationReports,
      onTimeSubmissions: timeliness.onTimeSubmissions,
      lateSubmissions: timeliness.lateSubmissions,
      avgSubmissionDelay: timeliness.avgDelay,
      firstTimeApprovalRate,
      avgClarificationResponseTime,
      scoreChange: 0, // Would need historical data
      trend,
      needsAttention,
      topPerformer,
      recommendations,
    }
  }

  const analyzeTimeliness = (reports: any[]) => {
    let onTimeSubmissions = 0
    let lateSubmissions = 0
    let totalDelay = 0

    reports.forEach(report => {
      const reportDate = new Date(report.report_date)
      const submittedDate = new Date(report.created_at)
      const hoursDelay = differenceInHours(submittedDate, reportDate)

      if (hoursDelay <= 24) {
        onTimeSubmissions++
      } else {
        lateSubmissions++
        totalDelay += hoursDelay
      }
    })

    const avgDelay = lateSubmissions > 0 ? totalDelay / lateSubmissions : 0
    const onTimeRate = reports.length > 0 ? (onTimeSubmissions / reports.length) * 100 : 0

    // Score: 20 points for 100% on-time, proportional decrease
    const score = (onTimeRate / 100) * 20

    return {
      onTimeSubmissions,
      lateSubmissions,
      avgDelay,
      onTimeRate,
      score,
    }
  }

  const calculateAvgResponseTime = (reports: any[]): number => {
    const reportsWithClarification = reports.filter(
      r => r.clarification_thread && r.clarification_thread.length > 0
    )

    if (reportsWithClarification.length === 0) return 0

    let totalResponseTime = 0
    let responseCount = 0

    reportsWithClarification.forEach(report => {
      const thread = report.clarification_thread || []
      const questions = thread.filter((m: any) => m.type === 'question')
      const responses = thread.filter((m: any) => m.type === 'response')

      if (questions.length > 0 && responses.length > 0) {
        const firstQuestion = questions[0]
        const firstResponse = responses[0]
        const hours = differenceInHours(
          new Date(firstResponse.timestamp),
          new Date(firstQuestion.timestamp)
        )
        totalResponseTime += hours
        responseCount++
      }
    })

    return responseCount > 0 ? totalResponseTime / responseCount : 0
  }

  const calculateResponseScore = (avgResponseTime: number): number => {
    // 15 points for response time
    // < 4 hours = 15 points
    // 4-8 hours = 12 points
    // 8-24 hours = 8 points
    // > 24 hours = 3 points
    if (avgResponseTime === 0) return 15 // No clarifications needed (good!)
    if (avgResponseTime < 4) return 15
    if (avgResponseTime < 8) return 12
    if (avgResponseTime < 24) return 8
    return 3
  }

  const generateRecommendations = (metrics: {
    submissionRate: number
    approvalRate: number
    timeliness: number
    clarificationRate: number
    avgResponseTime: number
  }): string[] => {
    const recs: string[] = []

    if (metrics.submissionRate < 80) {
      recs.push('Submit reports daily to maintain compliance and avoid backlogs.')
    }

    if (metrics.approvalRate < 70) {
      recs.push('Review rejected reports to understand quality issues. Focus on accuracy and completeness.')
    }

    if (metrics.timeliness < 70) {
      recs.push('Submit reports on the same day as the report date. Late submissions affect overall score.')
    }

    if (metrics.clarificationRate > 20) {
      recs.push('High clarification rate detected. Double-check reports before submission to reduce back-and-forth.')
    }

    if (metrics.avgResponseTime > 12) {
      recs.push('Respond to BDM clarifications within 4-8 hours to speed up the approval process.')
    }

    if (recs.length === 0) {
      recs.push('Excellent performance! Keep maintaining these high standards.')
    }

    return recs
  }

  const ScoreGauge = ({ score, size = 'md' }: { score: number; size?: 'sm' | 'md' | 'lg' }) => {
    const sizeClasses = {
      sm: 'w-20 h-20',
      md: 'w-32 h-32',
      lg: 'w-40 h-40',
    }

    const textSizes = {
      sm: 'text-lg',
      md: 'text-3xl',
      lg: 'text-4xl',
    }

    const getColor = () => {
      if (score >= 85) return { stroke: '#10b981', bg: 'bg-green-50', text: 'text-green-600' }
      if (score >= 70) return { stroke: '#3b82f6', bg: 'bg-blue-50', text: 'text-blue-600' }
      if (score >= 50) return { stroke: '#f59e0b', bg: 'bg-yellow-50', text: 'text-yellow-600' }
      return { stroke: '#ef4444', bg: 'bg-red-50', text: 'text-red-600' }
    }

    const color = getColor()
    const circumference = 2 * Math.PI * 45
    const offset = circumference - (score / 100) * circumference

    return (
      <div className={`relative ${sizeClasses[size]} ${color.bg} rounded-full p-2`}>
        <svg className="transform -rotate-90 w-full h-full">
          {/* Background circle */}
          <circle
            cx="50%"
            cy="50%"
            r="45%"
            stroke="#e5e7eb"
            strokeWidth="8"
            fill="none"
          />
          {/* Progress circle */}
          <circle
            cx="50%"
            cy="50%"
            r="45%"
            stroke={color.stroke}
            strokeWidth="8"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className={`${textSizes[size]} font-bold ${color.text}`}>
              {score.toFixed(0)}
            </div>
            <div className="text-xs text-gray-500">score</div>
          </div>
        </div>
      </div>
    )
  }

  const getScoreGrade = (score: number): { grade: string; label: string; color: string } => {
    if (score >= 90) return { grade: 'A+', label: 'Outstanding', color: 'text-green-600' }
    if (score >= 85) return { grade: 'A', label: 'Excellent', color: 'text-green-600' }
    if (score >= 75) return { grade: 'B', label: 'Good', color: 'text-blue-600' }
    if (score >= 60) return { grade: 'C', label: 'Fair', color: 'text-yellow-600' }
    if (score >= 50) return { grade: 'D', label: 'Needs Improvement', color: 'text-orange-600' }
    return { grade: 'F', label: 'Critical', color: 'text-red-600' }
  }

  const ManagerCard = ({ manager, rank }: { manager: ManagerPerformance; rank?: number }) => {
    const grade = getScoreGrade(manager.overallScore)
    const isExpanded = showScoreBreakdown === manager.id

    return (
      <div className={`card ${manager.topPerformer ? 'border-2 border-yellow-300 bg-gradient-to-br from-yellow-50 to-amber-50' : manager.needsAttention ? 'border-2 border-red-300 bg-red-50' : ''}`}>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start space-x-4 flex-1">
            {rank && (
              <div className="flex-shrink-0">
                {rank === 1 ? (
                  <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center">
                    <Medal className="w-6 h-6 text-white" />
                  </div>
                ) : rank === 2 ? (
                  <div className="w-12 h-12 bg-gradient-to-br from-gray-300 to-gray-400 rounded-full flex items-center justify-center">
                    <Medal className="w-6 h-6 text-white" />
                  </div>
                ) : rank === 3 ? (
                  <div className="w-12 h-12 bg-gradient-to-br from-orange-300 to-orange-400 rounded-full flex items-center justify-center">
                    <Medal className="w-6 h-6 text-white" />
                  </div>
                ) : (
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                    <span className="text-lg font-bold text-gray-600">#{rank}</span>
                  </div>
                )}
              </div>
            )}
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 mb-1">
                <h3 className="font-bold text-gray-900 text-lg">{manager.name}</h3>
                {manager.topPerformer && <Star className="w-5 h-5 text-yellow-500 fill-current" />}
              </div>
              <div className="text-sm text-gray-600 mb-2">
                {manager.role === 'front_office_manager' ? 'Front Office Manager' : 'Store Manager'}
              </div>
              <div className="flex items-center space-x-3 text-sm">
                <span className={`font-bold ${grade.color}`}>{grade.grade}</span>
                <span className="text-gray-500">•</span>
                <span className={grade.color}>{grade.label}</span>
              </div>
            </div>
          </div>

          <ScoreGauge score={manager.overallScore} size="md" />
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-3 mb-4 p-3 bg-white rounded-lg">
          <div className="text-center">
            <div className="text-xs text-gray-500">Reports</div>
            <div className="text-lg font-bold text-gray-900">{manager.totalReports}</div>
            <div className="text-xs text-gray-400">of {manager.expectedReports}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-500">Approved</div>
            <div className="text-lg font-bold text-green-600">{manager.approvedReports}</div>
            <div className="text-xs text-gray-400">
              {manager.totalReports > 0 ? ((manager.approvedReports / manager.totalReports) * 100).toFixed(0) : 0}%
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-500">On-Time</div>
            <div className="text-lg font-bold text-blue-600">{manager.onTimeSubmissions}</div>
            <div className="text-xs text-gray-400">
              {manager.totalReports > 0 ? ((manager.onTimeSubmissions / manager.totalReports) * 100).toFixed(0) : 0}%
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-500">Rejected</div>
            <div className="text-lg font-bold text-red-600">{manager.rejectedReports}</div>
            <div className="text-xs text-gray-400">
              {manager.totalReports > 0 ? ((manager.rejectedReports / manager.totalReports) * 100).toFixed(0) : 0}%
            </div>
          </div>
        </div>

        {/* Score Breakdown Toggle */}
        <button
          onClick={() => setShowScoreBreakdown(isExpanded ? null : manager.id)}
          className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors mb-3"
        >
          <span className="text-sm font-medium text-gray-700">Score Breakdown</span>
          {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>

        {isExpanded && (
          <div className="mb-4 p-4 bg-gray-50 rounded-lg space-y-3">
            {[
              { label: 'Submission Rate', score: manager.scoreBreakdown.submissionRate, max: 30, desc: 'Reports submitted vs expected' },
              { label: 'Approval Rate', score: manager.scoreBreakdown.approvalRate, max: 35, desc: 'Quality of reports submitted' },
              { label: 'Timeliness', score: manager.scoreBreakdown.timeliness, max: 20, desc: 'On-time submission rate' },
              { label: 'Response Time', score: manager.scoreBreakdown.responseTime, max: 15, desc: 'Speed of clarification responses' },
            ].map((item, index) => (
              <div key={index}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <div>
                    <span className="font-medium text-gray-700">{item.label}</span>
                    <span className="text-gray-500 ml-2">({item.desc})</span>
                  </div>
                  <span className="font-bold text-gray-900">
                    {item.score.toFixed(1)}/{item.max}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      (item.score / item.max) >= 0.8 ? 'bg-green-500' :
                      (item.score / item.max) >= 0.6 ? 'bg-blue-500' :
                      (item.score / item.max) >= 0.4 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${(item.score / item.max) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Recommendations */}
        {manager.recommendations.length > 0 && (
          <div className="p-4 bg-blue-50 border-l-4 border-blue-500 rounded">
            <div className="flex items-start space-x-2 mb-2">
              <Target className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="font-semibold text-blue-900 text-sm">Coaching Tips</div>
            </div>
            <ul className="space-y-1 text-xs text-blue-700">
              {manager.recommendations.map((rec, index) => (
                <li key={index} className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Contact Button */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          
            href={`mailto:${manager.email}`}
            className="w-full btn-secondary text-sm flex items-center justify-center"
          >
            <MessageCircle className="w-4 h-4 mr-2" />
            Send Feedback
          </a>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-lg text-gray-600">Calculating performance scores...</div>
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
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Manager Performance</h1>
            <p className="text-gray-600">Performance scoring and coaching insights</p>
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

      {/* Performance Scoring Guide */}
      <div className="mb-8 card bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
        <div className="flex items-start space-x-3 mb-4">
          <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-bold text-blue-900 mb-2">How Performance Scoring Works (0-100 Points)</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
              <div className="p-3 bg-white rounded-lg">
                <div className="font-semibold text-gray-900 mb-1">Submission Rate (30pts)</div>
                <div className="text-xs text-gray-600">Reports submitted vs expected daily reports</div>
              </div>
              <div className="p-3 bg-white rounded-lg">
                <div className="font-semibold text-gray-900 mb-1">Approval Rate (35pts)</div>
                <div className="text-xs text-gray-600">Percentage of reports approved without rejection</div>
              </div>
              <div className="p-3 bg-white rounded-lg">
                <div className="font-semibold text-gray-900 mb-1">Timeliness (20pts)</div>
                <div className="text-xs text-gray-600">Reports submitted within 24 hours of report date</div>
              </div>
              <div className="p-3 bg-white rounded-lg">
                <div className="font-semibold text-gray-900 mb-1">Response Time (15pts)</div>
                <div className="text-xs text-gray-600">Speed of responding to clarification requests</div>
              </div>
            </div>
            <div className="mt-4 flex items-center space-x-4 text-xs">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-500 rounded"></div>
                <span className="text-gray-700">A (85-100) = Excellent</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-blue-500 rounded"></div>
                <span className="text-gray-700">B (70-84) = Good</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-yellow-500 rounded"></div>
                <span className="text-gray-700">C (60-69) = Fair</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-orange-500 rounded"></div>
                <span className="text-gray-700">D (50-59) = Needs Improvement</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-red-500 rounded"></div>
                <span className="text-gray-700">F (&lt;50) = Critical</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="card">
          <div className="text-sm text-gray-600 mb-1">Average Score</div>
          <div className="text-3xl font-bold text-gray-900">{data.averageScore.toFixed(1)}</div>
          <div className="text-xs text-gray-500 mt-1">{getScoreGrade(data.averageScore).label}</div>
        </div>

        <div className="card">
          <div className="text-sm text-gray-600 mb-1">Top Performers</div>
          <div className="text-3xl font-bold text-green-600">{data.topPerformers.length}</div>
          <div className="text-xs text-gray-500 mt-1">Score ≥ 85</div>
        </div>

        <div className="card">
          <div className="text-sm text-gray-600 mb-1">Needs Attention</div>
          <div className="text-3xl font-bold text-red-600">{data.needsAttention.length}</div>
          <div className="text-xs text-gray-500 mt-1">Score &lt; 60 or mostly late</div>
        </div>

        <div className="card">
          <div className="text-sm text-gray-600 mb-1">Total Reports</div>
          <div className="text-3xl font-bold text-gray-900">{data.totalReports}</div>
          <div className="text-xs text-gray-500 mt-1">in selected period</div>
        </div>
      </div>

      {/* Top Performers */}
      {data.topPerformers.length > 0 && (
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
            <Award className="w-6 h-6 text-yellow-500 mr-2" />
            🏆 Top Performers
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {data.topPerformers.map((manager, index) => (
              <ManagerCard key={manager.id} manager={manager} rank={index + 1} />
            ))}
          </div>
        </div>
      )}

      {/* Needs Attention */}
      {data.needsAttention.length > 0 && (
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
            <AlertCircle className="w-6 h-6 text-red-500 mr-2" />
            ⚠️ Needs Attention
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {data.needsAttention.map((manager) => (
              <ManagerCard key={manager.id} manager={manager} />
            ))}
          </div>
        </div>
      )}

      {/* All Managers Leaderboard */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
          <Users className="w-6 h-6 text-blue-500 mr-2" />
          Complete Leaderboard
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {data.allManagers.map((manager, index) => (
            <ManagerCard key={manager.id} manager={manager} rank={index + 1} />
          ))}
        </div>
      </div>
    </div>
  )
}