'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, TrendingUp, Plus, Trash2 } from 'lucide-react'
import Link from 'next/link'

const BANKS = ['Moniepoint', 'GTBank', 'Fairmoney', 'Zenith Bank', 'Access Bank', 'First Bank', 'UBA', 'Opay', 'Palmpay', 'Other']
const OTHER_SERVICE_TYPES = ['Photoshoot', 'Hall Rental', 'Conference Room', 'Event Space', 'Swimming Pool', 'Gym', 'Spa', 'Other']

interface BankPayment { bank: string; amount: number }
interface OtherService {
  type: string
  amount: number
  cashAmount: number
  cardBreakdown: BankPayment[]
  transferBreakdown: BankPayment[]
}

const emptyService = (): OtherService => ({
  type: '',
  amount: 0,
  cashAmount: 0,
  cardBreakdown: [{ bank: '', amount: 0 }],
  transferBreakdown: [{ bank: '', amount: 0 }],
})

export default function RevenueReportPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0])
  const [roomRevenue, setRoomRevenue] = useState(0)
  const [laundryRevenue, setLaundryRevenue] = useState(0)
  const [otherServices, setOtherServices] = useState<OtherService[]>([emptyService()])
  const [expandedService, setExpandedService] = useState<number | null>(null)
  const [cashPayments, setCashPayments] = useState(0)
  const [cardPayments, setCardPayments] = useState<BankPayment[]>([{ bank: '', amount: 0 }])
  const [transferPayments, setTransferPayments] = useState<BankPayment[]>([{ bank: '', amount: 0 }])
  const [notes, setNotes] = useState('')

  const otherServicesTotal = otherServices.reduce((s, svc) => s + (svc.amount || 0), 0)
  const totalRevenue = roomRevenue + laundryRevenue + otherServicesTotal
  const totalCard = cardPayments.reduce((s, p) => s + (p.amount || 0), 0)
  const totalTransfer = transferPayments.reduce((s, p) => s + (p.amount || 0), 0)
  const totalPayments = cashPayments + totalCard + totalTransfer

  // Generic helpers for top-level bank rows
  const addRow = (setter: React.Dispatch<React.SetStateAction<BankPayment[]>>) =>
    setter(prev => [...prev, { bank: '', amount: 0 }])
  const removeRow = (setter: React.Dispatch<React.SetStateAction<BankPayment[]>>, i: number) =>
    setter(prev => prev.filter((_, idx) => idx !== i))
  const updateRow = (setter: React.Dispatch<React.SetStateAction<BankPayment[]>>, i: number, field: 'bank' | 'amount', value: string | number) =>
    setter(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: value } : item))

  // Other service helpers
  const addService = () => setOtherServices(prev => [...prev, emptyService()])
  const removeService = (i: number) => setOtherServices(prev => prev.filter((_, idx) => idx !== i))
  const updateService = (i: number, field: keyof OtherService, value: unknown) =>
    setOtherServices(prev => prev.map((svc, idx) => idx === i ? { ...svc, [field]: value } : svc))

  const addServiceBankRow = (svcIdx: number, field: 'cardBreakdown' | 'transferBreakdown') =>
    setOtherServices(prev => prev.map((svc, idx) =>
      idx === svcIdx ? { ...svc, [field]: [...svc[field], { bank: '', amount: 0 }] } : svc
    ))
  const removeServiceBankRow = (svcIdx: number, field: 'cardBreakdown' | 'transferBreakdown', rowIdx: number) =>
    setOtherServices(prev => prev.map((svc, idx) =>
      idx === svcIdx ? { ...svc, [field]: svc[field].filter((_, i) => i !== rowIdx) } : svc
    ))
  const updateServiceBankRow = (svcIdx: number, field: 'cardBreakdown' | 'transferBreakdown', rowIdx: number, rowField: 'bank' | 'amount', value: string | number) =>
    setOtherServices(prev => prev.map((svc, idx) =>
      idx === svcIdx ? {
        ...svc,
        [field]: svc[field].map((row, i) => i === rowIdx ? { ...row, [rowField]: value } : row)
      } : svc
    ))

  // Auto-compute service total from its payment fields
  const recomputeServiceAmount = (svcIdx: number) => {
    setOtherServices(prev => prev.map((svc, idx) => {
      if (idx !== svcIdx) return svc
      const cardTotal = svc.cardBreakdown.reduce((s, p) => s + (p.amount || 0), 0)
      const transferTotal = svc.transferBreakdown.reduce((s, p) => s + (p.amount || 0), 0)
      return { ...svc, amount: (svc.cashAmount || 0) + cardTotal + transferTotal }
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const breakdown = {
        card_breakdown: cardPayments.filter(p => p.bank && p.amount > 0),
        transfer_breakdown: transferPayments.filter(p => p.bank && p.amount > 0),
        other_services: otherServices
          .filter(s => s.type && s.amount > 0)
          .map(s => ({
            type: s.type,
            amount: s.amount,
            cash: s.cashAmount,
            card: s.cardBreakdown.filter(p => p.bank && p.amount > 0),
            transfer: s.transferBreakdown.filter(p => p.bank && p.amount > 0),
          })),
      }
      const notesValue = `${notes ? notes + '\n' : ''}__PAYMENT_BREAKDOWN__\n${JSON.stringify(breakdown)}`

      const { error } = await supabase.from('revenue_reports').insert({
        manager_id: user.id,
        report_date: reportDate,
        room_revenue: roomRevenue,
        food_beverage_revenue: 0,
        laundry_revenue: laundryRevenue,
        other_services_revenue: otherServicesTotal,
        total_revenue: totalRevenue,
        cash_payments: cashPayments,
        card_payments: totalCard,
        transfer_payments: totalTransfer,
        notes: notesValue,
        status: 'pending',
      } as Record<string, unknown>)
      if (error) throw error
      alert('Revenue report submitted successfully!')
      router.push('/front-office/dashboard')
    } catch (error: unknown) {
      alert('Error: ' + (error as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <Link href="/front-office/dashboard" className="inline-flex items-center text-primary hover:text-primary-dark mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />Back to Dashboard
        </Link>
        <div className="flex items-center space-x-3">
          <TrendingUp className="w-8 h-8 text-emerald-500" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Revenue Report</h1>
            <p className="text-gray-600 mt-1">Submit daily revenue and payment breakdown</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Date */}
        <div className="card">
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Report Date</label>
            <input type="date" value={reportDate} onChange={e => setReportDate(e.target.value)} className="input-field max-w-xs" required />
          </div>

          {/* Revenue by Department */}
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Revenue by Department</h2>
          <div className="space-y-4 mb-5">
            {([
              { label: 'Room Revenue', value: roomRevenue, setter: setRoomRevenue, required: true },
              { label: 'Laundry Revenue', value: laundryRevenue, setter: setLaundryRevenue, required: false },
            ] as const).map(({ label, value, setter, required }) => (
              <div key={label} className="flex items-center gap-4">
                <label className="text-sm font-medium text-gray-700 w-52 flex-shrink-0">
                  {label}{required ? ' *' : ''}
                </label>
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₦</span>
                  <input
                    type="number" min="0" step="0.01"
                    value={value || ''}
                    onChange={e => setter(parseFloat(e.target.value) || 0)}
                    className="input-field pl-7" placeholder="0.00"
                    required={required}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Other Services */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700">Other Services Revenue</h3>
              <span className="text-sm font-bold text-emerald-600">Total: ₦{otherServicesTotal.toLocaleString()}</span>
            </div>

            <div className="space-y-3">
              {otherServices.map((svc, i) => (
                <div key={i} className="border border-gray-200 rounded-lg overflow-hidden">
                  {/* Service header row */}
                  <div className="flex items-center gap-3 p-3 bg-gray-50">
                    <select
                      value={svc.type}
                      onChange={e => updateService(i, 'type', e.target.value)}
                      className="input-field flex-1 text-sm"
                    >
                      <option value="">Select service type...</option>
                      {OTHER_SERVICE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <div className="relative w-36">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">₦</span>
                      <input
                        type="number" min="0" step="0.01"
                        value={svc.amount || ''}
                        onChange={e => updateService(i, 'amount', parseFloat(e.target.value) || 0)}
                        className="input-field pl-7 text-sm" placeholder="0.00"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setExpandedService(expandedService === i ? null : i)}
                      className="text-xs text-blue-600 hover:underline whitespace-nowrap"
                    >
                      {expandedService === i ? 'Hide' : 'Payment breakdown'}
                    </button>
                    {otherServices.length > 1 && (
                      <button type="button" onClick={() => removeService(i)} className="p-1.5 text-red-400 hover:bg-red-50 rounded">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Expandable payment breakdown */}
                  {expandedService === i && (
                    <div className="p-3 border-t border-gray-200 bg-white space-y-4">
                      {/* Cash */}
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-medium text-gray-600 w-20">Cash</span>
                        <div className="relative flex-1 max-w-xs">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">₦</span>
                          <input
                            type="number" min="0" step="0.01"
                            value={svc.cashAmount || ''}
                            onChange={e => {
                              updateService(i, 'cashAmount', parseFloat(e.target.value) || 0)
                              setTimeout(() => recomputeServiceAmount(i), 0)
                            }}
                            className="input-field pl-7 text-sm" placeholder="0.00"
                          />
                        </div>
                      </div>

                      {/* Card rows */}
                      <div>
                        <div className="text-xs font-medium text-gray-600 mb-2">Card / POS</div>
                        <div className="space-y-2">
                          {svc.cardBreakdown.map((row, ri) => (
                            <div key={ri} className="flex items-center gap-2">
                              <select
                                value={row.bank}
                                onChange={e => {
                                  updateServiceBankRow(i, 'cardBreakdown', ri, 'bank', e.target.value)
                                }}
                                className="input-field flex-1 text-xs"
                              >
                                <option value="">Select bank...</option>
                                {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                              </select>
                              <div className="relative w-32">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">₦</span>
                                <input
                                  type="number" min="0" step="0.01"
                                  value={row.amount || ''}
                                  onChange={e => {
                                    updateServiceBankRow(i, 'cardBreakdown', ri, 'amount', parseFloat(e.target.value) || 0)
                                    setTimeout(() => recomputeServiceAmount(i), 0)
                                  }}
                                  className="input-field pl-7 text-xs" placeholder="0.00"
                                />
                              </div>
                              {svc.cardBreakdown.length > 1 && (
                                <button type="button" onClick={() => { removeServiceBankRow(i, 'cardBreakdown', ri); setTimeout(() => recomputeServiceAmount(i), 0) }} className="text-red-400 hover:text-red-600">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                        <button type="button" onClick={() => addServiceBankRow(i, 'cardBreakdown')} className="mt-1.5 text-xs text-blue-600 flex items-center gap-1">
                          <Plus className="w-3 h-3" /> Add card terminal
                        </button>
                      </div>

                      {/* Transfer rows */}
                      <div>
                        <div className="text-xs font-medium text-gray-600 mb-2">Transfer</div>
                        <div className="space-y-2">
                          {svc.transferBreakdown.map((row, ri) => (
                            <div key={ri} className="flex items-center gap-2">
                              <select
                                value={row.bank}
                                onChange={e => updateServiceBankRow(i, 'transferBreakdown', ri, 'bank', e.target.value)}
                                className="input-field flex-1 text-xs"
                              >
                                <option value="">Select bank...</option>
                                {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                              </select>
                              <div className="relative w-32">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">₦</span>
                                <input
                                  type="number" min="0" step="0.01"
                                  value={row.amount || ''}
                                  onChange={e => {
                                    updateServiceBankRow(i, 'transferBreakdown', ri, 'amount', parseFloat(e.target.value) || 0)
                                    setTimeout(() => recomputeServiceAmount(i), 0)
                                  }}
                                  className="input-field pl-7 text-xs" placeholder="0.00"
                                />
                              </div>
                              {svc.transferBreakdown.length > 1 && (
                                <button type="button" onClick={() => { removeServiceBankRow(i, 'transferBreakdown', ri); setTimeout(() => recomputeServiceAmount(i), 0) }} className="text-red-400 hover:text-red-600">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                        <button type="button" onClick={() => addServiceBankRow(i, 'transferBreakdown')} className="mt-1.5 text-xs text-blue-600 flex items-center gap-1">
                          <Plus className="w-3 h-3" /> Add bank
                        </button>
                      </div>

                      <p className="text-xs text-gray-400 italic">The amount above auto-updates from payment totals when you enter them.</p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <button type="button" onClick={addService} className="mt-3 flex items-center space-x-1 text-sm text-primary hover:text-primary-dark font-medium">
              <Plus className="w-4 h-4" /><span>Add service</span>
            </button>
          </div>

          {/* Total Revenue */}
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex justify-between items-center">
            <span className="font-semibold text-gray-900">Total Revenue</span>
            <span className="text-2xl font-bold text-emerald-600">₦{totalRevenue.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>

        {/* Payment Methods */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-5">Overall Payment Methods</h2>
          <p className="text-xs text-gray-500 mb-4">Enter the overall payment breakdown for room &amp; laundry. Other services payments are tracked individually above.</p>

          <div className="mb-6 pb-6 border-b border-gray-100">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Cash Payments</label>
            <div className="relative max-w-xs">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₦</span>
              <input type="number" min="0" step="0.01" value={cashPayments || ''}
                onChange={e => setCashPayments(parseFloat(e.target.value) || 0)}
                className="input-field pl-7" placeholder="0.00" />
            </div>
          </div>

          <div className="mb-6 pb-6 border-b border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-semibold text-gray-700">Card / POS Payments</label>
              <span className="text-sm font-bold text-blue-600">Total: ₦{totalCard.toLocaleString()}</span>
            </div>
            <div className="space-y-3">
              {cardPayments.map((p, i) => (
                <div key={i} className="flex items-center gap-3">
                  <select value={p.bank} onChange={e => updateRow(setCardPayments, i, 'bank', e.target.value)} className="input-field flex-1">
                    <option value="">Select POS / bank terminal...</option>
                    {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">₦</span>
                    <input type="number" min="0" step="0.01" value={p.amount || ''}
                      onChange={e => updateRow(setCardPayments, i, 'amount', parseFloat(e.target.value) || 0)}
                      className="input-field pl-7" placeholder="0.00" />
                  </div>
                  {cardPayments.length > 1 && (
                    <button type="button" onClick={() => removeRow(setCardPayments, i)} className="p-2 text-red-400 hover:bg-red-50 rounded-lg">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button type="button" onClick={() => addRow(setCardPayments)} className="mt-3 flex items-center space-x-1 text-sm text-primary hover:text-primary-dark font-medium">
              <Plus className="w-4 h-4" /><span>Add POS terminal</span>
            </button>
          </div>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-semibold text-gray-700">Transfer Payments</label>
              <span className="text-sm font-bold text-purple-600">Total: ₦{totalTransfer.toLocaleString()}</span>
            </div>
            <div className="space-y-3">
              {transferPayments.map((p, i) => (
                <div key={i} className="flex items-center gap-3">
                  <select value={p.bank} onChange={e => updateRow(setTransferPayments, i, 'bank', e.target.value)} className="input-field flex-1">
                    <option value="">Select receiving bank...</option>
                    {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">₦</span>
                    <input type="number" min="0" step="0.01" value={p.amount || ''}
                      onChange={e => updateRow(setTransferPayments, i, 'amount', parseFloat(e.target.value) || 0)}
                      className="input-field pl-7" placeholder="0.00" />
                  </div>
                  {transferPayments.length > 1 && (
                    <button type="button" onClick={() => removeRow(setTransferPayments, i)} className="p-2 text-red-400 hover:bg-red-50 rounded-lg">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button type="button" onClick={() => addRow(setTransferPayments)} className="mt-3 flex items-center space-x-1 text-sm text-primary hover:text-primary-dark font-medium">
              <Plus className="w-4 h-4" /><span>Add bank</span>
            </button>
          </div>

          {/* Payment summary */}
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 mt-4">
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-gray-600"><span>Cash</span><span>₦{cashPayments.toLocaleString()}</span></div>
              {cardPayments.filter(p => p.bank && p.amount > 0).map((p, i) => (
                <div key={i} className="flex justify-between text-blue-600 pl-3 text-xs"><span>↳ {p.bank} (Card/POS)</span><span>₦{p.amount.toLocaleString()}</span></div>
              ))}
              {transferPayments.filter(p => p.bank && p.amount > 0).map((p, i) => (
                <div key={i} className="flex justify-between text-purple-600 pl-3 text-xs"><span>↳ {p.bank} (Transfer)</span><span>₦{p.amount.toLocaleString()}</span></div>
              ))}
              <div className="border-t pt-2 flex justify-between font-bold text-gray-900 text-base">
                <span>Total Payments</span><span>₦{totalPayments.toLocaleString()}</span>
              </div>
            </div>
            {totalPayments > 0 && Math.abs(totalPayments - totalRevenue) > 0.01 ? (
              <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-700 font-medium">
                ⚠️ Payments (₦{totalPayments.toLocaleString()}) don't match revenue (₦{totalRevenue.toLocaleString()})
              </div>
            ) : totalPayments > 0 ? (
              <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-xs text-green-700 font-medium">
                ✅ Payments balance with revenue
              </div>
            ) : null}
          </div>
        </div>

        {/* Notes */}
        <div className="card">
          <label className="block text-sm font-medium text-gray-700 mb-2">Notes (Optional)</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="input-field"
            placeholder="Any additional notes about today's revenue..." />
        </div>

        <div className="flex gap-4">
          <button type="submit" disabled={loading} className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? 'Submitting...' : 'Submit Revenue Report'}
          </button>
          <Link href="/front-office/dashboard" className="btn-secondary">Cancel</Link>
        </div>
      </form>
    </div>
  )
}