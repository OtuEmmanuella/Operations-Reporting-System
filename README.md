# Manager Reporting System

A modern, real-time reporting dashboard for managers to submit Stock, Sales, and Expense reports with BDM oversight.

## 🎯 Features

- **Manager Portal**
  - Submit Stock Reports (inventory levels)
  - Submit Sales Reports (daily sales transactions)
  - Submit Expense Reports (requisitions/items received)
  - View submission history and status
  - Real-time status updates

- **BDM Portal**
  - View all reports in real-time
  - Live feed of new submissions
  - Review and approve/reject reports
  - Analytics and insights
  - Manager management

- **Security**
  - Secure authentication with Supabase
  - Role-based access control (Manager vs BDM)
  - Row-level security policies

- **Technical Features**
  - Real-time updates using Supabase subscriptions
  - Responsive design with Tailwind CSS
  - TypeScript for type safety
  - Modern UI with Lucide icons

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ installed
- A Supabase account (free tier works perfectly)
- Git

### Step 1: Clone and Install

\`\`\`bash
cd manager-reporting-system
npm install
\`\`\`

### Step 2: Set Up Supabase

1. Go to [https://supabase.com](https://supabase.com) and create a new project
2. Wait for the project to be ready (2-3 minutes)
3. Go to **Project Settings** > **API**
4. Copy your **Project URL** and **anon public** key

### Step 3: Configure Environment Variables

1. Create a file named `.env.local` in the root directory
2. Add your Supabase credentials:

\`\`\`env
NEXT_PUBLIC_SUPABASE_URL=your_project_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
\`\`\`

### Step 4: Set Up Database

1. Go to your Supabase project dashboard
2. Click on **SQL Editor** in the left sidebar
3. Click **New query**
4. Copy and paste the entire SQL schema from `SUPABASE_SETUP.sql` (see below)
5. Click **Run** to execute

### Step 5: Create Your First Users

Since users are manually added (no signup), you need to create them in Supabase:

1. Go to **Authentication** > **Users** in Supabase dashboard
2. Click **Add user** > **Create new user**
3. Enter email and password
4. After creating the user in Auth, go to **Table Editor** > **users** table
5. Click **Insert** > **Insert row**
6. Fill in:
   - `id`: Copy the UUID from the Auth user you just created
   - `email`: Same email as Auth user
   - `full_name`: Manager or BDM name
   - `role`: Either `manager` or `bdm`
7. Click **Save**

**Example Users to Create:**
- Manager: `manager@company.com` / password: `Manager123!` / role: `manager`
- BDM: `bdm@company.com` / password: `BDM123!` / role: `bdm`

### Step 6: Run the Application

\`\`\`bash
npm run dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📋 Database Schema

Create this schema in Supabase SQL Editor:

\`\`\`sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. USERS TABLE
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT CHECK (role IN ('manager', 'bdm')) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 2. STOCK REPORTS
CREATE TABLE stock_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  manager_id UUID REFERENCES users(id) NOT NULL,
  report_date DATE NOT NULL,
  status TEXT CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 3. STOCK REPORT ITEMS
CREATE TABLE stock_report_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id UUID REFERENCES stock_reports(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  unit TEXT NOT NULL
);

-- 4. SALES REPORTS
CREATE TABLE sales_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  manager_id UUID REFERENCES users(id) NOT NULL,
  report_date DATE NOT NULL,
  total_amount NUMERIC NOT NULL,
  status TEXT CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 5. SALES REPORT ITEMS
CREATE TABLE sales_report_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id UUID REFERENCES sales_reports(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  unit_price NUMERIC NOT NULL,
  total_price NUMERIC NOT NULL
);

-- 6. EXPENSE REPORTS
CREATE TABLE expense_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  manager_id UUID REFERENCES users(id) NOT NULL,
  report_date DATE NOT NULL,
  total_amount NUMERIC NOT NULL,
  status TEXT CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 7. EXPENSE REPORT ITEMS
CREATE TABLE expense_report_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id UUID REFERENCES expense_reports(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  unit_price NUMERIC NOT NULL,
  total_price NUMERIC NOT NULL,
  supplier TEXT
);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_report_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_report_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_report_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Users can view their own data"
  ON users FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'bdm'
  ));

-- RLS Policies for stock_reports
CREATE POLICY "Managers can view their own stock reports, BDM can view all"
  ON stock_reports FOR SELECT
  TO authenticated
  USING (manager_id = auth.uid() OR EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'bdm'
  ));

CREATE POLICY "Managers can insert their own stock reports"
  ON stock_reports FOR INSERT
  TO authenticated
  WITH CHECK (manager_id = auth.uid());

-- RLS Policies for stock_report_items
CREATE POLICY "Users can view items of accessible reports"
  ON stock_report_items FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM stock_reports 
    WHERE stock_reports.id = stock_report_items.report_id
    AND (stock_reports.manager_id = auth.uid() OR EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'bdm'
    ))
  ));

CREATE POLICY "Managers can insert items for their own reports"
  ON stock_report_items FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM stock_reports 
    WHERE stock_reports.id = stock_report_items.report_id
    AND stock_reports.manager_id = auth.uid()
  ));

-- Similar policies for sales_reports
CREATE POLICY "Managers can view their own sales reports, BDM can view all"
  ON sales_reports FOR SELECT
  TO authenticated
  USING (manager_id = auth.uid() OR EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'bdm'
  ));

CREATE POLICY "Managers can insert their own sales reports"
  ON sales_reports FOR INSERT
  TO authenticated
  WITH CHECK (manager_id = auth.uid());

CREATE POLICY "Users can view items of accessible sales reports"
  ON sales_report_items FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM sales_reports 
    WHERE sales_reports.id = sales_report_items.report_id
    AND (sales_reports.manager_id = auth.uid() OR EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'bdm'
    ))
  ));

CREATE POLICY "Managers can insert items for their own sales reports"
  ON sales_report_items FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM sales_reports 
    WHERE sales_reports.id = sales_report_items.report_id
    AND sales_reports.manager_id = auth.uid()
  ));

-- Similar policies for expense_reports
CREATE POLICY "Managers can view their own expense reports, BDM can view all"
  ON expense_reports FOR SELECT
  TO authenticated
  USING (manager_id = auth.uid() OR EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'bdm'
  ));

CREATE POLICY "Managers can insert their own expense reports"
  ON expense_reports FOR INSERT
  TO authenticated
  WITH CHECK (manager_id = auth.uid());

CREATE POLICY "Users can view items of accessible expense reports"
  ON expense_report_items FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM expense_reports 
    WHERE expense_reports.id = expense_report_items.report_id
    AND (expense_reports.manager_id = auth.uid() OR EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'bdm'
    ))
  ));

CREATE POLICY "Managers can insert items for their own expense reports"
  ON expense_report_items FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM expense_reports 
    WHERE expense_reports.id = expense_report_items.report_id
    AND expense_reports.manager_id = auth.uid()
  ));

-- Enable Realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE stock_reports;
ALTER PUBLICATION supabase_realtime ADD TABLE sales_reports;
ALTER PUBLICATION supabase_realtime ADD TABLE expense_reports;
\`\`\`

## 🎨 Color Scheme

- **Primary Blue**: `#2563eb` - Trust, professionalism
- **Secondary Gray**: `#64748b` - Neutral, clean
- **Success Green**: `#10b981` - Approved status
- **Warning Amber**: `#f59e0b` - Pending status
- **Danger Red**: `#ef4444` - Rejected status

## 📱 User Flows

### Manager Flow
1. Login → Dashboard
2. See quick action cards for each report type
3. Click "Submit Stock/Sales/Expense Report"
4. Fill form with items
5. Submit (status: pending)
6. Return to dashboard and see recent submissions

### BDM Flow
1. Login → Dashboard
2. See live feed of all reports
3. View pending reports count
4. Click on reports to review details
5. Approve or reject reports
6. View analytics

## 🏗️ Project Structure

\`\`\`
manager-reporting-system/
├── app/
│   ├── manager/
│   │   ├── dashboard/         # Manager home
│   │   ├── stock-report/      # Stock form
│   │   ├── sales-report/      # Sales form
│   │   └── expense-report/    # Expense form
│   ├── bdm/
│   │   ├── dashboard/         # BDM home with live feed
│   │   ├── pending/           # Pending reports
│   │   └── analytics/         # Data analysis
│   ├── globals.css            # Global styles
│   └── page.tsx               # Login page
├── components/
│   └── Sidebar.tsx            # Reusable sidebar
├── lib/
│   └── supabase.ts            # Supabase client
└── README.md
\`\`\`

## 🔐 Security Notes

- Users are manually added by admin (no public signup)
- Row-level security ensures managers only see their own reports
- BDM can see all reports
- Authentication handled by Supabase

## 🆘 Troubleshooting

**Problem**: "Failed to fetch" error
- Check your `.env.local` file has correct Supabase credentials
- Make sure Supabase project is active

**Problem**: Can't login
- Verify user exists in both Auth and users table
- Check that `id` in users table matches Auth user ID
- Ensure role is set correctly ('manager' or 'bdm')

**Problem**: No real-time updates
- Make sure you ran the Realtime ALTER PUBLICATION commands
- Check Supabase dashboard for any errors

## 📦 Dependencies

- Next.js 14 - React framework
- TypeScript - Type safety
- Tailwind CSS - Styling
- Supabase - Backend & Auth
- Lucide React - Icons
- date-fns - Date formatting
- Recharts - Analytics charts

## 🚢 Deployment

Deploy to Vercel:
1. Push code to GitHub
2. Import project in Vercel
3. Add environment variables in Vercel settings
4. Deploy!

## 📧 Support

For issues or questions, check the Supabase logs and browser console for errors.

---

Built with ❤️ for efficient team reporting
\`\`\`
