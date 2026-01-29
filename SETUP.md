# 🚀 QUICK START GUIDE

## Step 1: Install Dependencies
\`\`\`bash
npm install
\`\`\`

## Step 2: Set Up Supabase

### A. Create Supabase Project
1. Go to https://supabase.com
2. Sign up / Log in
3. Click "New Project"
4. Choose a name (e.g., "manager-reports")
5. Set a database password (save this!)
6. Wait 2-3 minutes for setup

### B. Get Your Credentials
1. In your project, click "Settings" (gear icon)
2. Click "API" in the left menu
3. Copy these two values:
   - Project URL
   - anon public key

### C. Create Environment File
1. In the project root, create file: `.env.local`
2. Paste this and replace with your values:
\`\`\`
NEXT_PUBLIC_SUPABASE_URL=your_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
\`\`\`

## Step 3: Set Up Database

### Copy the SQL Schema
1. In Supabase dashboard, click "SQL Editor"
2. Click "+ New query"
3. Copy ALL the SQL below and paste it
4. Click "Run" (or press Ctrl+Enter)

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

-- RLS Policies
CREATE POLICY "Users can view their own data"
  ON users FOR SELECT TO authenticated
  USING (id = auth.uid() OR EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'bdm'
  ));

CREATE POLICY "Managers can view their own stock reports, BDM can view all"
  ON stock_reports FOR SELECT TO authenticated
  USING (manager_id = auth.uid() OR EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'bdm'
  ));

CREATE POLICY "Managers can insert their own stock reports"
  ON stock_reports FOR INSERT TO authenticated
  WITH CHECK (manager_id = auth.uid());

CREATE POLICY "Users can view items of accessible reports"
  ON stock_report_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM stock_reports 
    WHERE stock_reports.id = stock_report_items.report_id
    AND (stock_reports.manager_id = auth.uid() OR EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'bdm'
    ))
  ));

CREATE POLICY "Managers can insert items for their own reports"
  ON stock_report_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM stock_reports 
    WHERE stock_reports.id = stock_report_items.report_id
    AND stock_reports.manager_id = auth.uid()
  ));

CREATE POLICY "Managers can view their own sales reports, BDM can view all"
  ON sales_reports FOR SELECT TO authenticated
  USING (manager_id = auth.uid() OR EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'bdm'
  ));

CREATE POLICY "Managers can insert their own sales reports"
  ON sales_reports FOR INSERT TO authenticated
  WITH CHECK (manager_id = auth.uid());

CREATE POLICY "Users can view items of accessible sales reports"
  ON sales_report_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM sales_reports 
    WHERE sales_reports.id = sales_report_items.report_id
    AND (sales_reports.manager_id = auth.uid() OR EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'bdm'
    ))
  ));

CREATE POLICY "Managers can insert items for their own sales reports"
  ON sales_report_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM sales_reports 
    WHERE sales_reports.id = sales_report_items.report_id
    AND sales_reports.manager_id = auth.uid()
  ));

CREATE POLICY "Managers can view their own expense reports, BDM can view all"
  ON expense_reports FOR SELECT TO authenticated
  USING (manager_id = auth.uid() OR EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'bdm'
  ));

CREATE POLICY "Managers can insert their own expense reports"
  ON expense_reports FOR INSERT TO authenticated
  WITH CHECK (manager_id = auth.uid());

CREATE POLICY "Users can view items of accessible expense reports"
  ON expense_report_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM expense_reports 
    WHERE expense_reports.id = expense_report_items.report_id
    AND (expense_reports.manager_id = auth.uid() OR EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'bdm'
    ))
  ));

CREATE POLICY "Managers can insert items for their own expense reports"
  ON expense_report_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM expense_reports 
    WHERE expense_reports.id = expense_report_items.report_id
    AND expense_reports.manager_id = auth.uid()
  ));

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE stock_reports;
ALTER PUBLICATION supabase_realtime ADD TABLE sales_reports;
ALTER PUBLICATION supabase_realtime ADD TABLE expense_reports;
\`\`\`

## Step 4: Create Test Users

### A. Create in Authentication
1. In Supabase, click "Authentication" → "Users"
2. Click "Add user" → "Create new user"
3. Create TWO users:
   - **Manager**: manager@test.com / password: Test123!
   - **BDM**: bdm@test.com / password: Test123!
4. Note down the UUID (user ID) for each

### B. Add to Users Table
1. Click "Table Editor" → "users"
2. Click "Insert" → "Insert row"
3. For the MANAGER:
   - id: (paste the manager's UUID from auth.users)
   - email: manager@test.com
   - full_name: John Manager
   - role: manager
4. Repeat for BDM:
   - id: (paste the BDM's UUID from auth.users)
   - email: bdm@test.com
   - full_name: Sarah BDM
   - role: bdm

## Step 5: Run the Application

\`\`\`bash
npm run dev
\`\`\`

Open http://localhost:3000

### Test Login
- Manager: manager@test.com / Test123!
- BDM: bdm@test.com / Test123!

## Step 6: Test the Flow

### As Manager:
1. Login → Dashboard
2. Click "Submit Stock Report"
3. Add items (Rice, 50, bags)
4. Submit
5. See it in Recent Submissions

### As BDM:
1. Login → Dashboard
2. See the report appear in Live Feed!
3. Verify real-time works (submit another report as manager in different tab)

---

## ✅ SUCCESS CHECKLIST

- [ ] Dependencies installed
- [ ] Supabase project created
- [ ] .env.local file created with correct credentials
- [ ] Database schema executed (all tables created)
- [ ] Test users created in Auth
- [ ] Test users added to users table
- [ ] App running on localhost:3000
- [ ] Can login as manager
- [ ] Can submit reports
- [ ] Can login as BDM
- [ ] BDM sees reports in real-time

---

## 🆘 TROUBLESHOOTING

### "Module not found" error
\`\`\`bash
rm -rf node_modules package-lock.json
npm install
\`\`\`

### "Failed to fetch" on login
- Check .env.local has correct Supabase URL and key
- Restart dev server: Ctrl+C then `npm run dev`

### Can't login / Invalid credentials
- Verify user exists in Authentication tab
- Verify user exists in users table with correct UUID
- Check password is correct

### Reports not showing
- Check RLS policies are created
- Verify user ID matches in both auth.users and users table
- Check browser console (F12) for errors

---

## 🎉 YOU'RE READY!

Your reporting system is now live! You can:
- Submit reports as manager
- See them in real-time as BDM
- Start building additional features

Next steps:
- Read BUILD_GUIDE.md for detailed explanations
- Add the pending reports page
- Add analytics charts
- Customize colors and branding
