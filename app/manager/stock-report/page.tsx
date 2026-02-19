'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Package, Plus, Trash2, DollarSign, ChevronDown } from 'lucide-react'
import Link from 'next/link'

const BANKS = ['Moniepoint', 'GTBank', 'Fairmoney', 'Zenith Bank', 'Access Bank', 'First Bank', 'UBA', 'Opay', 'Palmpay', 'Other']

interface StockRow {
  item_name: string
  previous_qty: number
  new_qty: number
}

interface MenuItem {
  id: string
  name: string
  unit_price: number
  category?: string
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
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [menuLoading, setMenuLoading] = useState(true)
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0])

  const [stockRows, setStockRows] = useState<StockRow[]>([{ ...BLANK_STOCK_ROW }])
  const [salesItems, setSalesItems] = useState<SalesItem[]>([{ ...BLANK_SALES_ITEM }])
  const [cashPayments, setCashPayments] = useState(0)
  const [cardPayments, setCardPayments] = useState<BankPayment[]>([{ ...BLANK_PAYMENT }])
  const [transferPayments, setTransferPayments] = useState<BankPayment[]>([{ ...BLANK_PAYMENT }])
  const [notes, setNotes] = useState('')

  useEffect(() => {
    const loadMenuItems = async () => {
      try {
        const { data } = await supabase
          .from('menu_items')
          .select('id, name, unit_price, category')
          .eq('is_active', true)
          .order('name')
        setMenuItems(data || [])
      } catch (err) {
        console.error('Error loading menu items:', err)
      } finally {
        setMenuLoading(false)
      }
    }
    loadMenuItems()
  }, [])

  // Calculations
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

      const breakdown = {
        card_breakdown: cardPayments.filter(p => p.bank && p.amount > 0),
        transfer_breakdown: transferPayments.filter(p => p.bank && p.amount > 0),
      }
      const notesValue = `${notes ? notes + '\n' : ''}__PAYMENT_BREAKDOWN__\n${JSON.stringify(breakdown)}`

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

      if (reportError) throw reportError

      // Save each stock row as two items: previous_stock and new_stock
      const stockItems = stockRows
        .filter(r => r.item_name.trim())
        .flatMap(r => [
          { report_id: report.id, item_section: 'previous_stock', item_name: r.item_name, quantity: r.previous_qty, unit: null, unit_price: null },
          { report_id: report.id, item_section: 'new_stock', item_name: r.item_name, quantity: r.new_qty, unit: null, unit_price: null },
        ])

      const salesDbItems = salesItems
        .filter(i => i.item_name.trim() && i.quantity > 0)
        .map(i => ({ report_id: report.id, item_section: 'sales', item_name: i.item_name, quantity: i.quantity, unit: null, unit_price: i.unit_price }))

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
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <Link href="/manager/dashboard" className="inline-flex items-center text-primary hover:text-primary-dark mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Link>
        <div className="flex items-center space-x-3">
          <Package className="w-8 h-8 text-blue-500" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Daily Stock & Sales Report</h1>
            <p className="text-gray-600 mt-1">Record today's stock levels and sales</p>
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

        {/* ── STOCK TABLE ── */}
        <div className="card bg-purple-50 border-purple-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-purple-900">📦 Stock Levels</h2>
              <p className="text-sm text-purple-700">Enter yesterday's closing stock and today's requisitions received</p>
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

          <div className="bg-white rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-purple-100">
                <tr>
                  <th className="px-4 py-3 text-left text-purple-900 font-semibold">Item</th>
                  <th className="px-4 py-3 text-right text-purple-900 font-semibold">Previous Day's Stock<br/><span className="font-normal text-xs text-purple-600">(Closing Stock)</span></th>
                  <th className="px-4 py-3 text-right text-purple-900 font-semibold">New Stock<br/><span className="font-normal text-xs text-purple-600">(Requisition Received)</span></th>
                  <th className="px-4 py-3 text-right text-purple-900 font-semibold">Total Available</th>
                  <th className="px-4 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {stockRows.map((row, i) => (
                  <tr key={i} className="border-t border-purple-100">
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={row.item_name}
                        onChange={(e) => updateStockRow(i, 'item_name', e.target.value)}
                        className="input-field"
                        placeholder="e.g., Rice"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.previous_qty || ''}
                        onChange={(e) => updateStockRow(i, 'previous_qty', parseFloat(e.target.value) || 0)}
                        className="input-field text-right"
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
                        className="input-field text-right"
                        placeholder="0"
                      />
                    </td>
                    <td className="px-4 py-2 text-right font-bold text-purple-900">
                      {((row.previous_qty || 0) + (row.new_qty || 0)).toLocaleString()}
                    </td>
                    <td className="px-2 py-2 text-center">
                      {stockRows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeStockRow(i)}
                          className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── SALES ── */}
        <div className="card bg-orange-50 border-orange-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-orange-900 flex items-center">
                <DollarSign className="w-6 h-6 mr-2" />
                Sales (What You Sold Today)
              </h2>
              <p className="text-sm text-orange-700">Select items from the menu — price fills automatically</p>
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

          {menuLoading ? (
            <div className="p-4 bg-white rounded-lg text-sm text-gray-500">Loading menu items...</div>
          ) : menuItems.length === 0 ? (
            <div className="p-4 bg-white rounded-lg text-sm text-amber-600 font-medium">
              ⚠️ No menu items found. Please ask your BDM to add menu items in the system.
            </div>
          ) : null}

          <div className="space-y-3">
            {salesItems.map((item, i) => (
              <div key={i} className="grid grid-cols-4 gap-3 p-3 bg-white rounded-lg items-end">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Menu Item</label>
                  <div className="relative">
                    <select
                      value={item.menu_item_id}
                      onChange={(e) => handleMenuSelect(i, e.target.value)}
                      className="input-field appearance-none pr-8"
                    >
                      <option value="">— Select item —</option>
                      {menuItems.map(m => (
                        <option key={m.id} value={m.id}>
                          {m.name}{m.category ? ` (${m.category})` : ''}
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
                    className="input-field"
                    placeholder="0"
                  />
                </div>
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <div className="text-xs text-gray-600 mb-1">Total</div>
                    <div className={`text-sm font-bold px-3 py-2 rounded ${item.unit_price > 0 ? 'bg-orange-100 text-orange-900' : 'bg-gray-100 text-gray-400'}`}>
                      {item.unit_price > 0
                        ? `₦${(item.quantity * item.unit_price).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`
                        : '₦0.00'}
                    </div>
                    {item.unit_price > 0 && (
                      <div className="text-xs text-gray-400 mt-0.5">@ ₦{item.unit_price.toLocaleString()} each</div>
                    )}
                  </div>
                  {salesItems.length > 1 && (
                    <button type="button" onClick={() => removeSalesItem(i)} className="p-2 text-red-400 hover:bg-red-50 rounded-lg">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 p-4 bg-orange-600 rounded-lg text-white">
            <div className="flex justify-between items-center">
              <span className="text-lg font-bold">Total Sales Revenue</span>
              <span className="text-3xl font-bold">
                ₦{totalSalesRevenue.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        {/* ── PAYMENT METHODS ── */}
        <div className="card">
          <h2 className="text-lg font-bold text-gray-900 mb-4">💰 Payment Methods</h2>

          <div className="mb-6 pb-6 border-b">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Cash Payments</label>
            <div className="relative max-w-xs">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₦</span>
              <input type="number" min="0" step="0.01" value={cashPayments || ''} onChange={(e) => setCashPayments(parseFloat(e.target.value) || 0)} className="input-field pl-7" placeholder="0.00" />
            </div>
          </div>

          <div className="mb-6 pb-6 border-b">
            <div className="flex justify-between items-center mb-3">
              <label className="text-sm font-semibold text-gray-700">Card / POS Payments</label>
              <span className="text-sm font-bold text-blue-600">Total: ₦{totalCard.toLocaleString()}</span>
            </div>
            <div className="space-y-3">
              {cardPayments.map((p, i) => (
                <div key={i} className="flex gap-3">
                  <select value={p.bank} onChange={(e) => updatePaymentRow(setCardPayments, i, 'bank', e.target.value)} className="input-field flex-1">
                    <option value="">Select POS terminal...</option>
                    {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">₦</span>
                    <input type="number" min="0" step="0.01" value={p.amount || ''} onChange={(e) => updatePaymentRow(setCardPayments, i, 'amount', parseFloat(e.target.value) || 0)} className="input-field pl-7" placeholder="0.00" />
                  </div>
                  {cardPayments.length > 1 && <button type="button" onClick={() => removePaymentRow(setCardPayments, i)} className="p-2 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>}
                </div>
              ))}
            </div>
            <button type="button" onClick={() => addPaymentRow(setCardPayments)} className="mt-3 flex items-center text-sm text-primary hover:text-primary-dark font-medium">
              <Plus className="w-4 h-4 mr-1" /> Add POS terminal
            </button>
          </div>

          <div className="mb-4">
            <div className="flex justify-between items-center mb-3">
              <label className="text-sm font-semibold text-gray-700">Transfer Payments</label>
              <span className="text-sm font-bold text-purple-600">Total: ₦{totalTransfer.toLocaleString()}</span>
            </div>
            <div className="space-y-3">
              {transferPayments.map((p, i) => (
                <div key={i} className="flex gap-3">
                  <select value={p.bank} onChange={(e) => updatePaymentRow(setTransferPayments, i, 'bank', e.target.value)} className="input-field flex-1">
                    <option value="">Select receiving bank...</option>
                    {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">₦</span>
                    <input type="number" min="0" step="0.01" value={p.amount || ''} onChange={(e) => updatePaymentRow(setTransferPayments, i, 'amount', parseFloat(e.target.value) || 0)} className="input-field pl-7" placeholder="0.00" />
                  </div>
                  {transferPayments.length > 1 && <button type="button" onClick={() => removePaymentRow(setTransferPayments, i)} className="p-2 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>}
                </div>
              ))}
            </div>
            <button type="button" onClick={() => addPaymentRow(setTransferPayments)} className="mt-3 flex items-center text-sm text-primary hover:text-primary-dark font-medium">
              <Plus className="w-4 h-4 mr-1" /> Add bank
            </button>
          </div>

          <div className="p-4 bg-gray-50 rounded-lg mt-4">
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-gray-600"><span>Cash</span><span>₦{cashPayments.toLocaleString()}</span></div>
              {cardPayments.filter(p => p.bank && p.amount > 0).map((p, i) => (
                <div key={i} className="flex justify-between text-blue-600 pl-3 text-xs"><span>↳ {p.bank} (Card/POS)</span><span>₦{p.amount.toLocaleString()}</span></div>
              ))}
              {transferPayments.filter(p => p.bank && p.amount > 0).map((p, i) => (
                <div key={i} className="flex justify-between text-purple-600 pl-3 text-xs"><span>↳ {p.bank} (Transfer)</span><span>₦{p.amount.toLocaleString()}</span></div>
              ))}
              <div className="border-t pt-2 flex justify-between font-bold text-gray-900"><span>Total Payments</span><span>₦{totalPayments.toLocaleString()}</span></div>
            </div>
            {totalPayments > 0 && Math.abs(totalPayments - totalSalesRevenue) > 0.01 ? (
              <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-700 font-medium">
                ⚠️ Payments (₦{totalPayments.toLocaleString()}) don't match sales revenue (₦{totalSalesRevenue.toLocaleString()})
              </div>
            ) : totalPayments > 0 ? (
              <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-xs text-green-700 font-medium">
                ✅ Payments balance with sales revenue
              </div>
            ) : null}
          </div>
        </div>

        {/* Notes */}
        <div className="card">
          <label className="block text-sm font-medium text-gray-700 mb-2">Additional Notes (Optional)</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="input-field" placeholder="Any additional information..." />
        </div>

        <div className="flex gap-4">
          <button type="submit" disabled={loading} className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? 'Submitting...' : 'Submit Daily Report'}
          </button>
          <Link href="/manager/dashboard" className="btn-secondary">Cancel</Link>
        </div>
      </form>
    </div>
  )
}