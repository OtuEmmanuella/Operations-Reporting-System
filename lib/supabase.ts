import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          full_name: string
          role: 'manager' | 'bdm'
          created_at: string
          department: string | null
          position: string | null
        }
        Insert: {
          id: string
          email: string
          full_name: string
          role: 'manager' | 'bdm'
          created_at?: string
          department?: string | null
          position?: string | null
        }
        Update: {
          id?: string
          email?: string
          full_name?: string
          role?: 'manager' | 'bdm'
          created_at?: string
          department?: string | null
          position?: string | null
        }
      }
      stock_reports: {
        Row: {
          id: string
          manager_id: string
          report_date: string
          status: 'pending' | 'approved' | 'rejected'
          notes: string | null
          created_at: string
          updated_at: string
          rejection_reason: string | null
          rejection_feedback: string | null
          resubmission_deadline: string | null
          reviewed_by: string | null
          reviewed_at: string | null
        }
        Insert: {
          id?: string
          manager_id: string
          report_date: string
          status?: 'pending' | 'approved' | 'rejected'
          notes?: string | null
          created_at?: string
          updated_at?: string
          rejection_reason?: string | null
          rejection_feedback?: string | null
          resubmission_deadline?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
        }
        Update: {
          id?: string
          manager_id?: string
          report_date?: string
          status?: 'pending' | 'approved' | 'rejected'
          notes?: string | null
          created_at?: string
          updated_at?: string
          rejection_reason?: string | null
          rejection_feedback?: string | null
          resubmission_deadline?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
        }
      }
      stock_report_items: {
        Row: {
          id: string
          report_id: string
          item_name: string
          quantity: number
          unit: string
        }
        Insert: {
          id?: string
          report_id: string
          item_name: string
          quantity: number
          unit: string
        }
        Update: {
          id?: string
          report_id?: string
          item_name?: string
          quantity?: number
          unit?: string
        }
      }
      sales_reports: {
        Row: {
          id: string
          manager_id: string
          report_date: string
          total_amount: number
          status: 'pending' | 'approved' | 'rejected'
          notes: string | null
          created_at: string
          updated_at: string
          rejection_reason: string | null
          rejection_feedback: string | null
          resubmission_deadline: string | null
          reviewed_by: string | null
          reviewed_at: string | null
        }
        Insert: {
          id?: string
          manager_id: string
          report_date: string
          total_amount: number
          status?: 'pending' | 'approved' | 'rejected'
          notes?: string | null
          created_at?: string
          updated_at?: string
          rejection_reason?: string | null
          rejection_feedback?: string | null
          resubmission_deadline?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
        }
        Update: {
          id?: string
          manager_id?: string
          report_date?: string
          total_amount?: number
          status?: 'pending' | 'approved' | 'rejected'
          notes?: string | null
          created_at?: string
          updated_at?: string
          rejection_reason?: string | null
          rejection_feedback?: string | null
          resubmission_deadline?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
        }
      }
      sales_report_items: {
        Row: {
          id: string
          report_id: string
          product_name: string
          quantity: number
          unit_price: number
          total_price: number
        }
        Insert: {
          id?: string
          report_id: string
          product_name: string
          quantity: number
          unit_price: number
          total_price: number
        }
        Update: {
          id?: string
          report_id?: string
          product_name?: string
          quantity?: number
          unit_price?: number
          total_price?: number
        }
      }
      expense_reports: {
        Row: {
          id: string
          manager_id: string
          report_date: string
          status: 'pending' | 'approved' | 'rejected'
          notes: string | null
          created_at: string
          updated_at: string
          rejection_reason: string | null
          rejection_feedback: string | null
          resubmission_deadline: string | null
          reviewed_by: string | null
          reviewed_at: string | null
        }
        Insert: {
          id?: string
          manager_id: string
          report_date: string
          status?: 'pending' | 'approved' | 'rejected'
          notes?: string | null
          created_at?: string
          updated_at?: string
          rejection_reason?: string | null
          rejection_feedback?: string | null
          resubmission_deadline?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
        }
        Update: {
          id?: string
          manager_id?: string
          report_date?: string
          status?: 'pending' | 'approved' | 'rejected'
          notes?: string | null
          created_at?: string
          updated_at?: string
          rejection_reason?: string | null
          rejection_feedback?: string | null
          resubmission_deadline?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
        }
      }
      expense_report_items: {
        Row: {
          id: string
          report_id: string
          item_name: string
          quantity: number
        }
        Insert: {
          id?: string
          report_id: string
          item_name: string
          quantity: number
        }
        Update: {
          id?: string
          report_id?: string
          item_name?: string
          quantity?: number
        }
      }
    }
  }
}

export const supabase = createClientComponentClient<Database>()