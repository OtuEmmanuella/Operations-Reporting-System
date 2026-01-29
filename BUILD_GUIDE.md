# Step-by-Step Build Guide

## 🎯 What You're Building

A reporting system where:
- **Managers** submit 3 types of reports (Stock, Sales, Expense)
- **BDM** receives and reviews all reports in real-time
- Everything updates live without page refresh

---

## 📚 BUILD ORDER (What Comes After What)

### Phase 1: Foundation (Already Done! ✅)
1. ✅ Package.json - All dependencies
2. ✅ Tailwind config - Colors and styling
3. ✅ TypeScript config - Type checking
4. ✅ Environment variables - Supabase connection
5. ✅ Supabase client - Database connection

### Phase 2: Authentication (Already Done! ✅)
6. ✅ Login page - Where users sign in
7. ✅ Auth logic - Checks if user is manager or BDM

### Phase 3: Layout & Navigation (Already Done! ✅)
8. ✅ Sidebar component - Navigation menu (reusable)
9. ✅ Manager layout - Wraps all manager pages
10. ✅ BDM layout - Wraps all BDM pages

### Phase 4: Manager Features (Already Done! ✅)
11. ✅ Manager Dashboard - Home screen with stats
12. ✅ Stock Report Form - Submit inventory
13. ✅ Sales Report Form - Submit sales
14. ✅ Expense Report Form - Submit requisitions

### Phase 5: BDM Features (Partially Done ✅)
15. ✅ BDM Dashboard - Live feed of all reports
16. ⏳ Pending Reports Page - Review & approve/reject
17. ⏳ Analytics Page - Charts and insights
18. ⏳ Managers Page - List all managers

---

## 🔄 HOW DATA FLOWS

### Manager Submits Report:
\`\`\`
Manager fills form 
  → Clicks Submit 
  → Data goes to Supabase 
  → Status = "pending"
  → Real-time subscription triggers
  → BDM dashboard updates instantly (without refresh!)
\`\`\`

### BDM Reviews Report:
\`\`\`
BDM sees new report in feed
  → Clicks to view details
  → Reviews items and amounts
  → Approves or Rejects
  → Status updates in database
  → Manager sees updated status on their dashboard
\`\`\`

---

## 🗂️ FILE STRUCTURE EXPLAINED

\`\`\`
app/
  page.tsx                    → Login page (first thing user sees)
  layout.tsx                  → Root layout (wraps everything)
  globals.css                 → Global styles
  
  manager/
    layout.tsx                → Manager wrapper (sidebar + auth check)
    dashboard/page.tsx        → Manager home (quick actions + stats)
    stock-report/page.tsx     → Stock form (item name, quantity, unit)
    sales-report/page.tsx     → Sales form (product, qty, price)
    expense-report/page.tsx   → Expense form (requisitions)
    my-reports/page.tsx       → (Not created yet) View all submissions
  
  bdm/
    layout.tsx                → BDM wrapper (sidebar + auth check)
    dashboard/page.tsx        → BDM home (live feed of reports)
    pending/page.tsx          → (Not created yet) Review pending reports
    analytics/page.tsx        → (Not created yet) Charts and data
    managers/page.tsx         → (Not created yet) List all managers

components/
  Sidebar.tsx                 → Navigation sidebar (used by both roles)

lib/
  supabase.ts                 → Database connection + TypeScript types
\`\`\`

---

## 🎨 UI BREAKDOWN

### Login Page
- **What it does**: User enters email & password
- **What happens**: Checks Supabase Auth → Redirects based on role
- **Goes to**: Manager Dashboard or BDM Dashboard

### Manager Dashboard
- **Shows**: 
  - Stats cards (total, pending, approved, rejected)
  - Quick action buttons (3 big buttons for each report type)
  - Recent submissions list
- **User clicks**: One of the quick action buttons
- **Goes to**: Respective report form

### Stock Report Form
- **Shows**:
  - Date picker (defaults to today)
  - "Add Item" button
  - For each item: Name, Quantity, Unit fields
  - Remove button (if more than 1 item)
  - Notes textarea
  - Submit & Cancel buttons
- **User fills**: Multiple items (e.g., "Rice, 50, bags")
- **User clicks**: Submit
- **What happens**: 
  1. Creates record in `stock_reports` table
  2. Creates records in `stock_report_items` table
  3. Status = "pending"
  4. Real-time update fires
- **Goes to**: Manager Dashboard with success message

### Sales Report Form
- **Same as Stock**, but:
  - Fields: Product Name, Quantity, Unit Price
  - Auto-calculates Total Price per item
  - Shows Grand Total at bottom
  - Saves to `sales_reports` and `sales_report_items`

### Expense Report Form
- **Same as Sales**, but:
  - Additional field: Supplier
  - Represents items received from store
  - Saves to `expense_reports` and `expense_report_items`

### BDM Dashboard
- **Shows**:
  - 4 stat cards (Stock count, Sales count, Expense count, Pending count)
  - Live feed section with "🔴 LIVE" indicator
  - Each report shows:
    - Manager name
    - Report type
    - Time submitted
    - Status badge
    - Amount (for sales/expense)
- **Real-time**: When manager submits, this page auto-updates
- **User clicks**: A report in the feed
- **Goes to**: Report detail page (not created yet)

---

## 🔌 REAL-TIME UPDATES EXPLAINED

In BDM Dashboard (`app/bdm/dashboard/page.tsx`), look for this code:

\`\`\`typescript
// Set up real-time subscriptions
const stockChannel = supabase
  .channel('stock_reports_changes')
  .on('postgres_changes', { 
    event: '*',           // Listen to all events (insert, update, delete)
    schema: 'public', 
    table: 'stock_reports' 
  }, () => {
    loadDashboardData()   // Reload data when change detected
  })
  .subscribe()
\`\`\`

**What this does**:
1. Creates a "channel" (like a radio frequency)
2. Listens for ANY change to `stock_reports` table
3. When change detected → Calls `loadDashboardData()` function
4. Function fetches fresh data from database
5. Updates the UI → User sees new report instantly!

**This is why the dashboard updates without refreshing the page.**

---

## 💾 DATABASE STRUCTURE

### users
- Stores: User info and role (manager or bdm)
- Links to: Supabase Auth

### stock_reports
- Stores: Report header (date, status, notes)
- Links to: users (who submitted)

### stock_report_items
- Stores: Individual items (rice, beans, etc.)
- Links to: stock_reports (which report)

**Same pattern for sales_reports/items and expense_reports/items**

### Relationship:
\`\`\`
1 User → Many Reports
1 Report → Many Items
\`\`\`

---

## 🔒 PENDING LOGIC

**Why do reports start as "pending"?**
1. Manager might make mistakes
2. BDM needs to verify accuracy
3. Creates approval workflow
4. Maintains data quality

**Status Flow:**
\`\`\`
pending → approved (BDM approves)
pending → rejected (BDM rejects)
\`\`\`

**How to implement approval** (not done yet):
1. Create button in BDM pending page
2. On click, update report status:
   \`\`\`typescript
   await supabase
     .from('stock_reports')
     .update({ status: 'approved' })
     .eq('id', reportId)
   \`\`\`
3. Real-time update triggers
4. Manager sees status change

---

## 🎯 WHAT TO BUILD NEXT

### 1. BDM Pending Reports Page
**File**: `app/bdm/pending/page.tsx`

**Should show**:
- List of all pending reports (from all managers)
- Filter by type (Stock, Sales, Expense)
- Each report card shows:
  - Manager name
  - Report type
  - Date
  - Items preview (first 3 items)
  - Approve/Reject buttons

**On Approve/Reject**:
- Update status in database
- Show success message
- Remove from pending list

### 2. Manager "My Reports" Page
**File**: `app/manager/my-reports/page.tsx`

**Should show**:
- Table of all reports submitted by this manager
- Columns: Date, Type, Status, Items Count, Actions
- Filter by status (All, Pending, Approved, Rejected)
- Click to view full details

### 3. BDM Analytics Page
**File**: `app/bdm/analytics/page.tsx`

**Should show**:
- Charts using Recharts library:
  - Reports per day (line chart)
  - Reports by type (pie chart)
  - Top selling products (bar chart)
  - Total sales/expenses over time
- Date range filter
- Export data button

---

## 🚀 TESTING CHECKLIST

1. ✅ Create test users in Supabase
2. ✅ Login as manager
3. ✅ Submit all 3 report types
4. ✅ Check manager dashboard shows reports
5. ✅ Login as BDM
6. ✅ Verify BDM sees reports in live feed
7. ⏳ Test real-time updates (submit report while BDM page open)
8. ⏳ Test approval workflow
9. ⏳ Test with multiple managers
10. ⏳ Test error handling (empty forms, network errors)

---

## 🆘 COMMON ISSUES & FIXES

### "Failed to fetch"
- **Cause**: Wrong Supabase credentials
- **Fix**: Check `.env.local` file

### Real-time not working
- **Cause**: Didn't enable Realtime on tables
- **Fix**: Run this in Supabase SQL editor:
  \`\`\`sql
  ALTER PUBLICATION supabase_realtime ADD TABLE stock_reports;
  ALTER PUBLICATION supabase_realtime ADD TABLE sales_reports;
  ALTER PUBLICATION supabase_realtime ADD TABLE expense_reports;
  \`\`\`

### Can't insert data
- **Cause**: RLS (Row Level Security) blocking
- **Fix**: Check policies in database or temporarily disable RLS for testing

### TypeScript errors
- **Cause**: Type mismatch
- **Fix**: Check `lib/supabase.ts` for correct types

---

## 📖 KEY CONCEPTS TO UNDERSTAND

### 1. Server vs Client Components
- Files with `'use client'` at top = Client component
- Use client for: Forms, buttons, useState, useEffect
- Server components for: Static content

### 2. Supabase Queries
\`\`\`typescript
// SELECT
const { data } = await supabase.from('table').select('*')

// INSERT
const { data } = await supabase.from('table').insert({ ... })

// UPDATE
await supabase.from('table').update({ ... }).eq('id', id)

// DELETE
await supabase.from('table').delete().eq('id', id)
\`\`\`

### 3. React State Management
\`\`\`typescript
// useState for data that changes
const [reports, setReports] = useState<Report[]>([])

// useEffect for loading data on page load
useEffect(() => {
  loadData()
}, [])
\`\`\`

---

## 🎓 LEARNING RESOURCES

- **Next.js**: https://nextjs.org/docs
- **Supabase**: https://supabase.com/docs
- **Tailwind CSS**: https://tailwindcss.com/docs
- **TypeScript**: https://www.typescriptlang.org/docs

---

## ✨ TIPS FOR SUCCESS

1. **Build one feature at a time** - Don't try to do everything at once
2. **Test as you go** - Run `npm run dev` and test each page
3. **Use the browser console** - Press F12 to see errors
4. **Copy patterns** - If something works in one form, copy it to others
5. **Ask for help** - Check documentation and examples

---

**You've got this! The foundation is solid. Now just build the remaining pages following the same patterns. 🚀**
