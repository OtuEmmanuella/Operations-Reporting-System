'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Plus, Trash2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface ExpenseItem {
  item_name: string
  quantity: number
  unit_price: number
  total_price: number
  supplier: string
}

export default function ExpenseReportPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<ExpenseItem[]>([
    { item_name: '', quantity: 0, unit_price: 0, total_price: 0, supplier: '' }
  ])

  const addItem = () => {
    setItems([...items, { item_name: '', quantity: 0, unit_price: 0, total_price: 0, supplier: '' }])
  }

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index))
    }
  }

  const updateItem = (index: number, field: keyof ExpenseItem, value: string | number) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }
    
    // Auto-calculate total price
    if (field === 'quantity' || field === 'unit_price') {
      const quantity = field === 'quantity' ? Number(value) : newItems[index].quantity
      const unitPrice = field === 'unit_price' ? Number(value) : newItems[index].unit_price
      newItems[index].total_price = quantity * unitPrice
    }
    
    setItems(newItems)
  }

  const getTotalAmount = () => {
    return items.reduce((sum, item) => sum + item.total_price, 0)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Validate items
      const validItems = items.filter(item => 
        item.item_name.trim() !== '' && item.quantity > 0 && item.unit_price > 0
      )

      if (validItems.length === 0) {
        alert('Please add at least one valid item')
        setLoading(false)
        return
      }

      const totalAmount = getTotalAmount()

      // Insert expense report
      const { data: report, error: reportError } = await supabase
        .from('expense_reports')
        .insert({
          manager_id: user.id,
          report_date: reportDate,
          total_amount: totalAmount,
          notes: notes || null,
          status: 'pending',
        })
        .select()
        .single()

      if (reportError) throw reportError

      // Insert expense items
      const itemsToInsert = validItems.map(item => ({
        report_id: report.id,
        item_name: item.item_name,
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price),
        total_price: Number(item.total_price),
        supplier: item.supplier || null,
      }))

      const { error: itemsError } = await supabase
        .from('expense_report_items')
        .insert(itemsToInsert)

      if (itemsError) throw itemsError

      alert('Expense report submitted successfully!')
      router.push('/manager/dashboard')
    } catch (error: any) {
      console.error('Error submitting report:', error)
      alert('Error submitting report: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <Link 
          href="/manager/dashboard" 
          className="inline-flex items-center text-primary hover:text-primary-dark mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Submit Expense Report</h1>
        <p className="text-gray-600 mt-2">Log items received from store (requisitions)</p>
      </div>

      <form onSubmit={handleSubmit} className="card">
        {/* Report Date */}
        <div className="mb-6">
          <label htmlFor="reportDate" className="block text-sm font-medium text-gray-700 mb-2">
            Report Date
          </label>
          <input
            id="reportDate"
            type="date"
            value={reportDate}
            onChange={(e) => setReportDate(e.target.value)}
            className="input-field max-w-xs"
            required
          />
        </div>

        {/* Expense Items */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Requisition Items</h3>
            <button
              type="button"
              onClick={addItem}
              className="inline-flex items-center px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg transition-colors duration-200"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Item
            </button>
          </div>

          <div className="space-y-4">
            {items.map((item, index) => (
              <div key={index} className="flex gap-4 items-start p-4 bg-gray-50 rounded-lg">
                <div className="flex-1 grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Item Name
                    </label>
                    <input
                      type="text"
                      value={item.item_name}
                      onChange={(e) => updateItem(index, 'item_name', e.target.value)}
                      className="input-field"
                      placeholder="e.g., Office Supplies"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Quantity
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={item.quantity || ''}
                      onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                      className="input-field"
                      placeholder="0"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Unit Price (₦)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unit_price || ''}
                      onChange={(e) => updateItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                      className="input-field"
                      placeholder="0.00"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Supplier
                    </label>
                    <input
                      type="text"
                      value={item.supplier}
                      onChange={(e) => updateItem(index, 'supplier', e.target.value)}
                      className="input-field"
                      placeholder="e.g., Store Name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Total (₦)
                    </label>
                    <input
                      type="number"
                      value={item.total_price.toFixed(2)}
                      className="input-field bg-gray-100"
                      disabled
                    />
                  </div>
                </div>
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    className="mt-8 p-2 text-danger hover:bg-danger/10 rounded-lg transition-colors duration-200"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Total Amount Display */}
          <div className="mt-6 p-4 bg-primary/5 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold text-gray-900">Total Expense Amount:</span>
              <span className="text-2xl font-bold text-primary">₦{getTotalAmount().toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="mb-6">
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
            Notes (Optional)
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            className="input-field"
            placeholder="Any additional comments about these requisitions..."
          />
        </div>

        {/* Submit Button */}
        <div className="flex gap-4">
          <button
            type="submit"
            disabled={loading}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Submitting...' : 'Submit Report'}
          </button>
          <Link href="/manager/dashboard" className="btn-secondary">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
