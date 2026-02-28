'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useMenuItems } from '@/lib/hooks/useMenuItems'
import { ArrowLeft, Package, Plus, Trash2, DollarSign, ChevronDown, Loader2 } from 'lucide-react'
import Link from 'next/link'

const BANKS = ['Moniepoint', 'GTBank', 'Fairmoney', 'Zenith Bank', 'Access Bank', 'First Bank', 'UBA', 'Opay', 'Palmpay', 'Other']

interface StockRow {
  item_name: string
  previous_qty: number
  new_qty: number
}

interface SalesItem {
  menu_item_id: string
  item_name: string
  quantity: number
  unit_price: number
}

interface BankPayment {
  bank: string
  amount: number
}

const BLANK_STOCK_ROW: StockRow = { item_name: '', previous_qty: 0, new_qty: 0 }
const BLANK_SALES_ITEM: SalesItem = { menu_item_id: '', item_name: '', quantity: 0, unit_price: 0 }
const BLANK_PAYMENT: BankPayment = { bank: '', amount: 0 }

export default function UnifiedStockReportPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0])

  // Use TanStack Query for menu items (cached, reduces reads)
  const { data: menuItems = [], isLoading: menuLoading, error: menuError } = useMenuItems()

  const [stockRows, setStockRows] = useState<StockRow[]>([{ ...BLANK_STOCK_ROW }])
  const [salesItems, setSalesItems] = useState<SalesItem[]>([{ ...BLANK_SALES_ITEM }])
  const [cashPayments, setCashPayments] = useState(0)
  const [cardPayments, setCardPayments] = useState<BankPayment[]>([{ ...BLANK_PAYMENT }])
  const [transferPayments, setTransferPayments] = useState<BankPayment[]>([{ ...BLANK_PAYMENT }])
  const [notes, setNotes] = useState('')

  // Calculations (NO totals for different stock items - only sales revenue and payments)
  const totalSalesRevenue = salesItems.reduce((sum, i) => sum + i.quantity * i.unit_price, 0)
  const totalCard = cardPayments.reduce((s, p) => s + (p.amount || 0), 0)
  const totalTransfer = transferPayments.reduce((s, p) => s + (p.amount || 0), 0)
  const totalPayments = cashPayments + totalCard + totalTransfer

  // Stock row helpers
  const addStockRow = () => setStockRows(prev => [...prev, { ...BLANK_STOCK_ROW }])
  const removeStockRow = (i: number) => setStockRows(prev => prev.filter((_, idx) => idx !== i))
  const updateStockRow = (i: number, field: keyof StockRow, value: any) =>
    setStockRows(prev => prev.map((row, idx) => idx === i ? { ...row, [field]: value } : row))

  // Sales helpers
  const addSalesItem = () => setSalesItems(prev => [...prev, { ...BLANK_SALES_ITEM }])
  const removeSalesItem = (i: number) => setSalesItems(prev => prev.filter((_, idx) => idx !== i))
  const handleMenuSelect = (i: number, menuItemId: string) => {
    const found = menuItems.find(m => m.id === menuItemId)
    setSalesItems(prev => prev.map((item, idx) =>
      idx === i ? { ...item, menu_item_id: menuItemId, item_name: found?.name || '', unit_price: found?.unit_price || 0 } : item
    ))
  }
  const updateSalesQty = (i: number, qty: number) =>
    setSalesItems(prev => prev.map((item, idx) => idx === i ? { ...item, quantity: qty } : item))

  // Payment helpers
  const addPaymentRow = (setter: React.Dispatch<React.SetStateAction<BankPayment[]>>) =>
    setter(prev => [...prev, { ...BLANK_PAYMENT }])
  const removePaymentRow = (setter: React.Dispatch<React.SetStateAction<BankPayment[]>>, i: number) =>
    setter(prev => prev.filter((_, idx) => idx !== i))
  const updatePaymentRow = (setter: React.Dispatch<React.SetStateAction<BankPayment[]>>, i: number, field: 'bank' | 'amount', value: any) =>
    setter(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: value } : item))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Validate that we have at least some stock data
      const hasStockData = stockRows.some(r => r.item_name.trim())
      if (!hasStockData) {
        alert('Please add at least one stock item')
        setLoading(false)
        return
      }

      const breakdown = {
        card_breakdown: cardPayments.filter(p => p.bank && p.amount > 0),
        transfer_breakdown: transferPayments.filter(p => p.bank && p.amount > 0),
      }
      const notesValue = `${notes ? notes + '\n' : ''}__PAYMENT_BREAKDOWN__\n${JSON.stringify(breakdown)}`

      // Check if a report already exists for this date
const { data: existing } = await supabase
  .from('stock_inventory_reports')
  .select('id, status')
  .eq('manager_id', user.id)
  .eq('report_date', reportDate)
  .maybeSingle()

if (existing) {
  const statusMsg = existing.status === 'approved' 
    ? 'already been APPROVED' 
    : existing.status === 'rejected'
    ? 'been REJECTED (please resubmit from your dashboard)'
    : 'already been submitted and is PENDING review'
  alert(`A report for ${reportDate} has ${statusMsg}. You cannot submit another report for the same date.`)
  setLoading(false)
  return
}

const { data: report, error: reportError } = await supabase
  .from('stock_inventory_reports')
  .insert({
    manager_id: user.id,
    report_date: reportDate,
    cash_payments: cashPayments,
    card_payments: totalCard,
    transfer_payments: totalTransfer,
    notes: notesValue,
    status: 'pending',
  })
  .select()
  .single()

if (reportError) {
  if (reportError.code === '23505') {
    alert(`A report for ${reportDate} already exists. You can only submit one report per day.`)
    setLoading(false)
    return
  }
  throw reportError
}

      // Save each stock row as two items: previous_stock and new_stock
     // ✅ NEW CODE - Don't include unit field at all if it's null
const stockItems = stockRows
  .filter(r => r.item_name.trim())
  .flatMap(r => [
    { 
      report_id: report.id, 
      item_section: 'previous_stock', 
      item_name: r.item_name, 
      quantity: r.previous_qty, 
      // unit field omitted - will be NULL by default
      unit_price: null 
    },
    { 
      report_id: report.id, 
      item_section: 'new_stock', 
      item_name: r.item_name, 
      quantity: r.new_qty, 
      // unit field omitted - will be NULL by default
      unit_price: null 
    },
  ])

const salesDbItems = salesItems
  .filter(i => i.item_name.trim() && i.quantity > 0)
  .map(i => ({ 
    report_id: report.id, 
    item_section: 'sales', 
    item_name: i.item_name, 
    quantity: i.quantity, 
    // unit field omitted - will be NULL by default
    unit_price: i.unit_price 
  }))

      const allItems = [...stockItems, ...salesDbItems]
      if (allItems.length > 0) {
        const { error: itemsError } = await supabase.from('stock_inventory_items').insert(allItems)
        if (itemsError) throw itemsError
      }

      alert('Stock & Sales report submitted successfully!')
      router.push('/manager/dashboard')
    } catch (error: any) {
      console.error('Error submitting report:', error)
      alert('Error: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <Link href="/manager/dashboard" className="inline-flex items-center text-primary hover:text-primary-dark mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Link>
        <div className="flex items-center space-x-3">
          <Package className="w-8 h-8 text-blue-500" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Daily Stock & Sales Report</h1>
            <p className="text-gray-600 mt-1">Comprehensive daily report: Stock levels + Sales transactions + Payment breakdown</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Report Date */}
        <div className="card">
          <label className="block text-sm font-medium text-gray-700 mb-2">Report Date</label>
          <input
            type="date"
            value={reportDate}
            onChange={(e) => setReportDate(e.target.value)}
            className="input-field max-w-xs"
            required
          />
        </div>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* SECTION 1: STOCK LEVELS TABLE (NO TOTALS - DIFFERENT ITEMS) */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <div className="card bg-purple-50 border-purple-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-purple-900">📦 SECTION 1: Stock Levels</h2>
              <p className="text-sm text-purple-700">Record yesterday's closing stock and today's new stock received (requisitions)</p>
            </div>
            <button
              type="button"
              onClick={addStockRow}
              className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Item
            </button>
          </div>

          <div className="bg-white rounded-lg overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-purple-100">
                <tr>
                  <th className="px-4 py-3 text-left text-purple-900 font-semibold w-1/3">Item Name</th>
                  <th className="px-4 py-3 text-right text-purple-900 font-semibold">
                    Previous Day's Stock
                    <br />
                    <span className="font-normal text-xs text-purple-600">(Yesterday's Closing)</span>
                  </th>
                  <th className="px-4 py-3 text-right text-purple-900 font-semibold">
                    New Stock Received
                    <br />
                    <span className="font-normal text-xs text-purple-600">(Today's Requisition)</span>
                  </th>
                  <th className="px-4 py-3 text-right text-purple-900 font-semibold bg-purple-200">
                    Total Available
                    <br />
                    <span className="font-normal text-xs text-purple-700">(Previous + New)</span>
                  </th>
                  <th className="px-4 py-3 w-12"></th>
                </tr>
              </thead>
              <tbody>
                {stockRows.map((row, i) => {
                  const totalForRow = (row.previous_qty || 0) + (row.new_qty || 0)
                  return (
                    <tr key={i} className="border-t border-purple-100 hover:bg-purple-50/50">
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={row.item_name}
                          onChange={(e) => updateStockRow(i, 'item_name', e.target.value)}
                          className="input-field text-sm"
                          placeholder="e.g., Rice 25kg bag"
                          required
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.previous_qty || ''}
                          onChange={(e) => updateStockRow(i, 'previous_qty', parseFloat(e.target.value) || 0)}
                          className="input-field text-right text-sm"
                          placeholder="0"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.new_qty || ''}
                          onChange={(e) => updateStockRow(i, 'new_qty', parseFloat(e.target.value) || 0)}
                          className="input-field text-right text-sm"
                          placeholder="0"
                        />
                      </td>
                      <td className="px-4 py-2 text-right font-bold text-purple-900 bg-purple-50">
                        {totalForRow.toLocaleString()}
                      </td>
                      <td className="px-2 py-2 text-center">
                        {stockRows.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeStockRow(i)}
                            className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                            title="Remove this row"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          
          {/* Info note - no totals needed for different items */}
          <div className="mt-4 p-3 bg-purple-100 rounded-lg">
            <p className="text-xs text-purple-800">
              <strong>Note:</strong> Each row tracks a different item, so totals across all items are not calculated. 
              Focus on the "Total Available" column for each individual item.
            </p>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* SECTION 2: SALES */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <div className="card bg-orange-50 border-orange-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-orange-900 flex items-center">
                <DollarSign className="w-6 h-6 mr-2" />
                SECTION 2: Sales (What You Sold Today)
              </h2>
              <p className="text-sm text-orange-700">Select items from your branch menu — prices auto-fill, just enter quantities</p>
            </div>
            <button
              type="button"
              onClick={addSalesItem}
              className="flex items-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Sale
            </button>
          </div>

          {menuLoading && (
            <div className="p-4 bg-white rounded-lg text-sm text-gray-500 flex items-center space-x-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Loading menu items...</span>
            </div>
          )}

          {menuError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 font-medium">
              ⚠️ Error loading menu items. Please refresh the page.
            </div>
          )}

          {!menuLoading && !menuError && menuItems.length === 0 && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700 font-medium">
              ⚠️ No menu items found for your branch. Please contact your BDM to verify:
              <ul className="mt-2 ml-4 list-disc text-xs">
                <li>Your user account has a branch assigned (luxury, royale, or kingscourt)</li>
                <li>Menu items exist for your branch in the system</li>
              </ul>
            </div>
          )}

          {!menuLoading && !menuError && menuItems.length > 0 && (
            <>
              <div className="space-y-3">
                {salesItems.map((item, i) => (
                  <div key={i} className="grid grid-cols-5 gap-3 p-3 bg-white rounded-lg items-end shadow-sm hover:shadow-md transition-shadow">
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Menu Item</label>
                      <div className="relative">
                        <select
                          value={item.menu_item_id}
                          onChange={(e) => handleMenuSelect(i, e.target.value)}
                          className="input-field appearance-none pr-8 text-sm"
                        >
                          <option value="">— Select item from menu —</option>
                          {menuItems.map(m => (
                            <option key={m.id} value={m.id}>
                              {m.name}{m.category ? ` (${m.category})` : ''} - ₦{m.unit_price.toLocaleString()}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Quantity Sold</label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={item.quantity || ''}
                        onChange={(e) => updateSalesQty(i, parseFloat(e.target.value) || 0)}
                        className="input-field text-sm"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Unit Price</label>
                      <div className={`px-3 py-2 rounded text-sm font-semibold ${item.unit_price > 0 ? 'bg-gray-100 text-gray-700' : 'bg-gray-50 text-gray-400'}`}>
                        ₦{item.unit_price.toLocaleString()}
                      </div>
                    </div>
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <div className="text-xs text-gray-600 mb-1">Total Amount</div>
                        <div className={`text-sm font-bold px-3 py-2 rounded ${item.unit_price > 0 ? 'bg-orange-100 text-orange-900' : 'bg-gray-100 text-gray-400'}`}>
                          {item.unit_price > 0
                            ? `₦${(item.quantity * item.unit_price).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`
                            : '₦0.00'}
                        </div>
                      </div>
                      {salesItems.length > 1 && (
                        <button 
                          type="button" 
                          onClick={() => removeSalesItem(i)} 
                          className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                          title="Remove this sale"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Sales Summary */}
              <div className="mt-4 p-5 bg-gradient-to-r from-orange-600 to-red-600 rounded-lg text-white shadow-lg">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-sm opacity-90 mb-1">Total Sales Revenue</div>
                    <div className="text-xs opacity-75">
                      {salesItems.filter(i => i.quantity > 0).length} item(s) sold
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-4xl font-bold">
                      ₦{totalSalesRevenue.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* SECTION 3: PAYMENT METHODS */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <div className="card">
          <h2 className="text-lg font-bold text-gray-900 mb-2 flex items-center">
            <DollarSign className="w-6 h-6 mr-2 text-green-600" />
            SECTION 3: Payment Methods (How Customers Paid)
          </h2>
          <p className="text-sm text-gray-600 mb-4">Break down how you received payment for today's sales</p>

          {/* Cash Payments */}
          <div className="mb-6 pb-6 border-b">
            <label className="block text-sm font-semibold text-gray-700 mb-2">💵 Cash Payments</label>
            <div className="relative max-w-xs">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₦</span>
              <input 
                type="number" 
                min="0" 
                step="0.01" 
                value={cashPayments || ''} 
                onChange={(e) => setCashPayments(parseFloat(e.target.value) || 0)} 
                className="input-field pl-7" 
                placeholder="0.00" 
              />
            </div>
          </div>

          {/* Card / POS Payments */}
          <div className="mb-6 pb-6 border-b">
            <div className="flex justify-between items-center mb-3">
              <label className="text-sm font-semibold text-gray-700">💳 Card / POS Payments</label>
              <span className="text-sm font-bold text-blue-600">Total: ₦{totalCard.toLocaleString()}</span>
            </div>
            <div className="space-y-3">
              {cardPayments.map((p, i) => (
                <div key={i} className="flex gap-3">
                  <select 
                    value={p.bank} 
                    onChange={(e) => updatePaymentRow(setCardPayments, i, 'bank', e.target.value)} 
                    className="input-field flex-1"
                  >
                    <option value="">Select POS terminal...</option>
                    {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">₦</span>
                    <input 
                      type="number" 
                      min="0" 
                      step="0.01" 
                      value={p.amount || ''} 
                      onChange={(e) => updatePaymentRow(setCardPayments, i, 'amount', parseFloat(e.target.value) || 0)} 
                      className="input-field pl-7" 
                      placeholder="0.00" 
                    />
                  </div>
                  {cardPayments.length > 1 && (
                    <button 
                      type="button" 
                      onClick={() => removePaymentRow(setCardPayments, i)} 
                      className="p-2 text-red-400 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button 
              type="button" 
              onClick={() => addPaymentRow(setCardPayments)} 
              className="mt-3 flex items-center text-sm text-primary hover:text-primary-dark font-medium"
            >
              <Plus className="w-4 h-4 mr-1" /> Add POS terminal
            </button>
          </div>

          {/* Transfer Payments */}
          <div className="mb-4">
            <div className="flex justify-between items-center mb-3">
              <label className="text-sm font-semibold text-gray-700">🏦 Bank Transfer Payments</label>
              <span className="text-sm font-bold text-purple-600">Total: ₦{totalTransfer.toLocaleString()}</span>
            </div>
            <div className="space-y-3">
              {transferPayments.map((p, i) => (
                <div key={i} className="flex gap-3">
                  <select 
                    value={p.bank} 
                    onChange={(e) => updatePaymentRow(setTransferPayments, i, 'bank', e.target.value)} 
                    className="input-field flex-1"
                  >
                    <option value="">Select receiving bank...</option>
                    {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">₦</span>
                    <input 
                      type="number" 
                      min="0" 
                      step="0.01" 
                      value={p.amount || ''} 
                      onChange={(e) => updatePaymentRow(setTransferPayments, i, 'amount', parseFloat(e.target.value) || 0)} 
                      className="input-field pl-7" 
                      placeholder="0.00" 
                    />
                  </div>
                  {transferPayments.length > 1 && (
                    <button 
                      type="button" 
                      onClick={() => removePaymentRow(setTransferPayments, i)} 
                      className="p-2 text-red-400 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button 
              type="button" 
              onClick={() => addPaymentRow(setTransferPayments)} 
              className="mt-3 flex items-center text-sm text-primary hover:text-primary-dark font-medium"
            >
              <Plus className="w-4 h-4 mr-1" /> Add bank
            </button>
          </div>

          {/* Payment Summary */}
          <div className="p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg mt-4 border border-gray-200">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-gray-700 font-medium">
                <span>💵 Cash</span>
                <span>₦{cashPayments.toLocaleString()}</span>
              </div>
              {cardPayments.filter(p => p.bank && p.amount > 0).map((p, i) => (
                <div key={i} className="flex justify-between text-blue-600 pl-4 text-xs">
                  <span>↳ {p.bank} (Card/POS)</span>
                  <span>₦{p.amount.toLocaleString()}</span>
                </div>
              ))}
              {transferPayments.filter(p => p.bank && p.amount > 0).map((p, i) => (
                <div key={i} className="flex justify-between text-purple-600 pl-4 text-xs">
                  <span>↳ {p.bank} (Transfer)</span>
                  <span>₦{p.amount.toLocaleString()}</span>
                </div>
              ))}
              <div className="border-t-2 border-gray-300 pt-2 flex justify-between font-bold text-gray-900 text-base">
                <span>Total Payments Received</span>
                <span>₦{totalPayments.toLocaleString()}</span>
              </div>
            </div>

            {/* Payment Validation */}
            {totalPayments > 0 && Math.abs(totalPayments - totalSalesRevenue) > 0.01 ? (
              <div className="mt-3 p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-yellow-700 font-medium">
                      ⚠️ Payment Mismatch
                    </p>
                    <p className="text-xs text-yellow-600 mt-1">
                      Payments (₦{totalPayments.toLocaleString()}) don't match sales revenue (₦{totalSalesRevenue.toLocaleString()}). 
                      Difference: ₦{Math.abs(totalPayments - totalSalesRevenue).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            ) : totalPayments > 0 ? (
              <div className="mt-3 p-3 bg-green-50 border-l-4 border-green-400 rounded">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-green-700 font-medium">
                      ✅ Payments Balance Correctly
                    </p>
                    <p className="text-xs text-green-600 mt-1">
                      Total payments match sales revenue exactly
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* NOTES SECTION */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <div className="card">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            📝 Additional Notes (Optional)
          </label>
          <textarea 
            value={notes} 
            onChange={(e) => setNotes(e.target.value)} 
            rows={4} 
            className="input-field" 
            placeholder="Any additional information about today's stock, sales, or unusual circumstances..."
          />
          <div className="mt-2 text-xs text-gray-500">
            Examples: Stock discrepancies, damaged items, special promotions, supplier delays, etc.
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* SUBMIT BUTTONS */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <div className="flex gap-4">
          <button 
            type="submit" 
            disabled={loading} 
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Submitting...</span>
              </>
            ) : (
              <>
                <Package className="w-4 h-4" />
                <span>Submit Daily Report</span>
              </>
            )}
          </button>
          <Link href="/manager/dashboard" className="btn-secondary">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}