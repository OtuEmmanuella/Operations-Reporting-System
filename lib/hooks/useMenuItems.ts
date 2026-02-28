import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface MenuItem {
  id: string
  name: string
  unit_price: number
  category?: string
  branch: string
}

/**
 * Hook to fetch menu items for the current user's branch
 * 
 * Features:
 * - Automatically filtered by RLS based on user's branch
 * - Cached for 5 minutes to reduce database reads
 * - BDM sees all items across all branches
 * - Managers only see their branch's items
 * 
 * @returns Query result with menu items data, loading state, and error
 */
export function useMenuItems() {
  return useQuery({
    queryKey: ['menu-items'], // Single cache key - RLS handles branch filtering
    queryFn: async () => {
      // Get current user to ensure authentication
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      
      if (userError) throw userError
      if (!user) throw new Error('User not authenticated')

      // Fetch menu items - RLS automatically filters by user's branch
      // Managers see only their branch, BDM sees all
      const { data, error } = await supabase
        .from('menu_items')
        .select('id, name, unit_price, category, branch')
        .eq('is_active', true)
        .order('name')
      
      if (error) throw error
      
      // Return empty array if no data (better than null for rendering)
      return (data as MenuItem[]) || []
    },
    // Cache settings (5 min stale time reduces DB reads significantly)
    staleTime: 1000 * 60 * 5, // 5 minutes - data considered fresh
    gcTime: 1000 * 60 * 10, // 10 minutes - cache retention after unmount
    refetchOnWindowFocus: false, // Don't refetch when tab regains focus
    refetchOnMount: false, // Use cached data if available and fresh
    retry: 2, // Retry failed requests twice
  })
}

/**
 * Hook to fetch ALL menu items across all branches (BDM only)
 * 
 * This hook will return all menu items for BDM users, or only the user's 
 * branch items for managers (RLS enforces this automatically)
 * 
 * @returns Query result with all menu items grouped by branch
 */
export function useAllMenuItems() {
  return useQuery({
    queryKey: ['all-menu-items'], // Different cache key for BDM view
    queryFn: async () => {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      
      if (userError) throw userError
      if (!user) throw new Error('User not authenticated')

      // Fetch all menu items (RLS handles filtering)
      const { data, error } = await supabase
        .from('menu_items')
        .select('id, name, unit_price, category, branch')
        .order('branch', { ascending: true })
        .order('name', { ascending: true })
      
      if (error) throw error
      
      return (data as MenuItem[]) || []
    },
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
  })
}

/**
 * Hook to get menu items grouped by branch (useful for BDM analytics)
 */
export function useMenuItemsByBranch() {
  const { data, ...rest } = useAllMenuItems()
  
  const groupedData = data?.reduce((acc, item) => {
    const branch = item.branch || 'unassigned'
    if (!acc[branch]) {
      acc[branch] = []
    }
    acc[branch].push(item)
    return acc
  }, {} as Record<string, MenuItem[]>)

  return {
    data: groupedData,
    ...rest
  }
}

/**
 * Hook to get menu items count by branch (for dashboard stats)
 */
export function useMenuItemsStats() {
  const { data, ...rest } = useAllMenuItems()
  
  const stats = data?.reduce((acc, item) => {
    const branch = item.branch || 'unassigned'
    acc[branch] = (acc[branch] || 0) + 1
    acc.total = (acc.total || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return {
    data: stats,
    ...rest
  }
}