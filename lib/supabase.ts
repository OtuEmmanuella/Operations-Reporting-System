import { createBrowserClient } from '@supabase/ssr'

// Clarification thread message type
export interface ClarificationMessage {
  id: string
  type: 'question' | 'response'
  author_id: string
  author_name: string
  author_role: 'bdm' | 'manager'
  content: string
  timestamp: string
}

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          full_name: string
          role: 'manager' | 'bdm' | 'front_office_manager'  
          created_at: string
          department: string | null
          position: string | null
        }
        Insert: {
          id: string
          email: string
          full_name: string
          role: 'manager' | 'bdm' | 'front_office_manager'  
          created_at?: string
          department?: string | null
          position?: string | null
        }
        Update: {
          id?: string
          email?: string
          full_name?: string
          role?: 'manager' | 'bdm' | 'front_office_manager'  
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
          status: 'pending' | 'approved' | 'rejected' | 'clarification_requested'
          notes: string | null
          created_at: string
          updated_at: string
          rejection_reason: string | null
          rejection_feedback: string | null
          clarification_request: string | null
          clarification_response: string | null
          clarification_responded_at: string | null
          clarification_thread: ClarificationMessage[] | null
          resubmission_deadline: string | null
          reviewed_by: string | null
          reviewed_at: string | null
        }
        Insert: {
          id?: string
          manager_id: string
          report_date: string
          status?: 'pending' | 'approved' | 'rejected' | 'clarification_requested'
          notes?: string | null
          created_at?: string
          updated_at?: string
          rejection_reason?: string | null
          rejection_feedback?: string | null
          clarification_request?: string | null
          clarification_response?: string | null
          clarification_responded_at?: string | null
          clarification_thread?: ClarificationMessage[] | null
          resubmission_deadline?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
        }
        Update: {
          id?: string
          manager_id?: string
          report_date?: string
          status?: 'pending' | 'approved' | 'rejected' | 'clarification_requested'
          notes?: string | null
          created_at?: string
          updated_at?: string
          rejection_reason?: string | null
          rejection_feedback?: string | null
          clarification_request?: string | null
          clarification_response?: string | null
          clarification_responded_at?: string | null
          clarification_thread?: ClarificationMessage[] | null
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
          status: 'pending' | 'approved' | 'rejected' | 'clarification_requested'
          notes: string | null
          created_at: string
          updated_at: string
          rejection_reason: string | null
          rejection_feedback: string | null
          clarification_request: string | null
          clarification_response: string | null
          clarification_responded_at: string | null
          clarification_thread: ClarificationMessage[] | null
          resubmission_deadline: string | null
          reviewed_by: string | null
          reviewed_at: string | null
        }
        Insert: {
          id?: string
          manager_id: string
          report_date: string
          total_amount: number
          status?: 'pending' | 'approved' | 'rejected' | 'clarification_requested'
          notes?: string | null
          created_at?: string
          updated_at?: string
          rejection_reason?: string | null
          rejection_feedback?: string | null
          clarification_request?: string | null
          clarification_response?: string | null
          clarification_responded_at?: string | null
          clarification_thread?: ClarificationMessage[] | null
          resubmission_deadline?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
        }
        Update: {
          id?: string
          manager_id?: string
          report_date?: string
          total_amount?: number
          status?: 'pending' | 'approved' | 'rejected' | 'clarification_requested'
          notes?: string | null
          created_at?: string
          updated_at?: string
          rejection_reason?: string | null
          rejection_feedback?: string | null
          clarification_request?: string | null
          clarification_response?: string | null
          clarification_responded_at?: string | null
          clarification_thread?: ClarificationMessage[] | null
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
          status: 'pending' | 'approved' | 'rejected' | 'clarification_requested'
          notes: string | null
          created_at: string
          updated_at: string
          rejection_reason: string | null
          rejection_feedback: string | null
          clarification_request: string | null
          clarification_response: string | null
          clarification_responded_at: string | null
          clarification_thread: ClarificationMessage[] | null
          resubmission_deadline: string | null
          reviewed_by: string | null
          reviewed_at: string | null
        }
        Insert: {
          id?: string
          manager_id: string
          report_date: string
          status?: 'pending' | 'approved' | 'rejected' | 'clarification_requested'
          notes?: string | null
          created_at?: string
          updated_at?: string
          rejection_reason?: string | null
          rejection_feedback?: string | null
          clarification_request?: string | null
          clarification_response?: string | null
          clarification_responded_at?: string | null
          clarification_thread?: ClarificationMessage[] | null
          resubmission_deadline?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
        }
        Update: {
          id?: string
          manager_id?: string
          report_date?: string
          status?: 'pending' | 'approved' | 'rejected' | 'clarification_requested'
          notes?: string | null
          created_at?: string
          updated_at?: string
          rejection_reason?: string | null
          rejection_feedback?: string | null
          clarification_request?: string | null
          clarification_response?: string | null
          clarification_responded_at?: string | null
          clarification_thread?: ClarificationMessage[] | null
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
      occupancy_reports: {
        Row: {
          id: string
          manager_id: string
          report_date: string
          total_rooms: number
          occupied_rooms: number
          vacant_rooms: number
          maintenance_rooms: number
          occupancy_percentage: number
          status: 'pending' | 'approved' | 'rejected' | 'clarification_requested'
          notes: string | null
          rejection_reason: string | null
          rejection_feedback: string | null
          clarification_request: string | null
          clarification_response: string | null
          clarification_responded_at: string | null
          clarification_thread: any | null
          resubmission_deadline: string | null
          reviewed_by: string | null
          reviewed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          manager_id: string
          report_date: string
          total_rooms: number
          occupied_rooms: number
          vacant_rooms: number
          maintenance_rooms: number
          occupancy_percentage: number
          status?: 'pending' | 'approved' | 'rejected' | 'clarification_requested'
          notes?: string | null
          rejection_reason?: string | null
          rejection_feedback?: string | null
          clarification_request?: string | null
          clarification_response?: string | null
          clarification_responded_at?: string | null
          clarification_thread?: any | null
          resubmission_deadline?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          // Same as Insert but all optional
          id?: string
          manager_id?: string
          report_date?: string
          total_rooms?: number
          occupied_rooms?: number
          vacant_rooms?: number
          maintenance_rooms?: number
          occupancy_percentage?: number
          status?: 'pending' | 'approved' | 'rejected' | 'clarification_requested'
          notes?: string | null
          rejection_reason?: string | null
          rejection_feedback?: string | null
          clarification_request?: string | null
          clarification_response?: string | null
          clarification_responded_at?: string | null
          clarification_thread?: any | null
          resubmission_deadline?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      guest_activity_reports: {
        Row: {
          id: string
          manager_id: string
          report_date: string
          check_ins: number
          check_outs: number
          expected_arrivals: number
          expected_departures: number
          walk_ins: number
          no_shows: number
          status: 'pending' | 'approved' | 'rejected' | 'clarification_requested'
          notes: string | null
          rejection_reason: string | null
          rejection_feedback: string | null
          clarification_request: string | null
          clarification_response: string | null
          clarification_responded_at: string | null
          clarification_thread: any | null
          resubmission_deadline: string | null
          reviewed_by: string | null
          reviewed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          manager_id: string
          report_date: string
          check_ins?: number
          check_outs?: number
          expected_arrivals?: number
          expected_departures?: number
          walk_ins?: number
          no_shows?: number
          status?: 'pending' | 'approved' | 'rejected' | 'clarification_requested'
          notes?: string | null
          rejection_reason?: string | null
          rejection_feedback?: string | null
          clarification_request?: string | null
          clarification_response?: string | null
          clarification_responded_at?: string | null
          clarification_thread?: any | null
          resubmission_deadline?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          // All fields optional
          [key: string]: any
        }
      }
      revenue_reports: {
        Row: {
          id: string
          manager_id: string
          report_date: string
          room_revenue: number
          food_beverage_revenue: number
          laundry_revenue: number
          other_services_revenue: number
          total_revenue: number
          cash_payments: number
          card_payments: number
          transfer_payments: number
          status: 'pending' | 'approved' | 'rejected' | 'clarification_requested'
          notes: string | null
          rejection_reason: string | null
          rejection_feedback: string | null
          clarification_request: string | null
          clarification_response: string | null
          clarification_responded_at: string | null
          clarification_thread: any | null
          resubmission_deadline: string | null
          reviewed_by: string | null
          reviewed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          manager_id: string
          report_date: string
          room_revenue: number
          food_beverage_revenue?: number
          laundry_revenue?: number
          other_services_revenue?: number
          total_revenue: number
          cash_payments?: number
          card_payments?: number
          transfer_payments?: number
          status?: 'pending' | 'approved' | 'rejected' | 'clarification_requested'
          notes?: string | null
          [key: string]: any
        }
        Update: {
          [key: string]: any
        }
      }
      complaint_reports: {
        Row: {
          id: string
          manager_id: string
          report_date: string
          complaint_type: 'service' | 'room_condition' | 'billing' | 'staff_behavior' | 'amenities' | 'noise' | 'other'
          guest_name: string | null
          room_number: string | null
          description: string
          severity: 'low' | 'medium' | 'high' | 'critical'
          resolution_status: 'pending' | 'in_progress' | 'resolved'
          resolution_details: string | null
          resolved_at: string | null
          status: 'pending' | 'approved' | 'rejected' | 'clarification_requested'
          notes: string | null
          rejection_reason: string | null
          rejection_feedback: string | null
          clarification_request: string | null
          clarification_response: string | null
          clarification_responded_at: string | null
          clarification_thread: any | null
          reviewed_by: string | null
          reviewed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          manager_id: string
          report_date: string
          complaint_type: 'service' | 'room_condition' | 'billing' | 'staff_behavior' | 'amenities' | 'noise' | 'other'
          guest_name?: string | null
          room_number?: string | null
          description: string
          severity: 'low' | 'medium' | 'high' | 'critical'
          resolution_status?: 'pending' | 'in_progress' | 'resolved'
          resolution_details?: string | null
          resolved_at?: string | null
          status?: 'pending' | 'approved' | 'rejected' | 'clarification_requested'
          [key: string]: any
        }
        Update: {
          [key: string]: any
        }
      }
    }
  }
}

export const supabase = createBrowserClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)