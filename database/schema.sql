-- Enable RLS (Row Level Security)
-- NOTE: Replace this with your actual JWT secret in your local development environment
-- ALTER DATABASE postgres SET "app.jwt_secret" TO 'your-jwt-secret';

-- Create users table (managed by Supabase Auth)
-- Note: Supabase Auth already creates a 'auth.users' table
-- We'll create a public.users table to store additional user information

CREATE TABLE public.users (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create accounts table
CREATE TABLE public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  owner_ids UUID[] NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create categories table
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create expenses table
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  raw_amount DECIMAL(12, 2) NOT NULL,
  raw_frequency TEXT NOT NULL,
  normalised_amount DECIMAL(12, 2) NOT NULL,
  account_id UUID REFERENCES public.accounts(id),
  category_id UUID REFERENCES public.categories(id),
  import_source TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create expense_splits table
CREATE TABLE public.expense_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID REFERENCES public.expenses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id),
  ratio DECIMAL(5, 4) NOT NULL DEFAULT 0.5,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create income table
CREATE TABLE public.income (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id),
  source TEXT NOT NULL,
  raw_amount DECIMAL(12, 2) NOT NULL,
  raw_frequency TEXT NOT NULL,
  normalised_amount DECIMAL(12, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.income ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can only see their own data
CREATE POLICY "Users can view own data" ON public.users
  FOR SELECT USING (auth.uid() = id);

-- Accounts policy - users can see accounts where they are an owner
CREATE POLICY "Users can view own accounts" ON public.accounts
  FOR SELECT USING (auth.uid() = ANY(owner_ids));

-- Categories are visible to all authenticated users
CREATE POLICY "Categories are visible to authenticated users" ON public.categories
  FOR SELECT USING (auth.role() = 'authenticated');

-- Expenses policy - users can see expenses linked to accounts they own
CREATE POLICY "Users can view expenses for their accounts" ON public.expenses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.accounts 
      WHERE accounts.id = expenses.account_id 
      AND auth.uid() = ANY(accounts.owner_ids)
    )
  );

-- Expense splits policy - users can see their own expense splits
CREATE POLICY "Users can view own expense splits" ON public.expense_splits
  FOR SELECT USING (auth.uid() = user_id);

-- Income policy - users can see their own income
CREATE POLICY "Users can view own income" ON public.income
  FOR SELECT USING (auth.uid() = user_id);

-- Insert policies
CREATE POLICY "Users can insert own data" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own accounts" ON public.accounts
  FOR INSERT WITH CHECK (auth.uid() = ANY(owner_ids));

CREATE POLICY "Users can insert categories" ON public.categories
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can insert expenses for their accounts" ON public.expenses
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.accounts 
      WHERE accounts.id = expenses.account_id 
      AND auth.uid() = ANY(accounts.owner_ids)
    )
  );

CREATE POLICY "Users can insert own expense splits" ON public.expense_splits
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert own income" ON public.income
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Update policies
CREATE POLICY "Users can update own data" ON public.users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can update own accounts" ON public.accounts
  FOR UPDATE USING (auth.uid() = ANY(owner_ids));

CREATE POLICY "Users can update categories" ON public.categories
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Users can update expenses for their accounts" ON public.expenses
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.accounts 
      WHERE accounts.id = expenses.account_id 
      AND auth.uid() = ANY(accounts.owner_ids)
    )
  );

CREATE POLICY "Users can update own expense splits" ON public.expense_splits
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can update own income" ON public.income
  FOR UPDATE USING (auth.uid() = user_id);

-- Delete policies
CREATE POLICY "Users can delete own accounts" ON public.accounts
  FOR DELETE USING (auth.uid() = ANY(owner_ids));

CREATE POLICY "Users can delete categories" ON public.categories
  FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Users can delete expenses for their accounts" ON public.expenses
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.accounts 
      WHERE accounts.id = expenses.account_id 
      AND auth.uid() = ANY(accounts.owner_ids)
    )
  );

CREATE POLICY "Users can delete own expense splits" ON public.expense_splits
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own income" ON public.income
  FOR DELETE USING (auth.uid() = user_id);

-- Create default categories
INSERT INTO public.categories (name) VALUES
  ('Housing'),
  ('Utilities'),
  ('Groceries'),
  ('Transportation'),
  ('Health'),
  ('Insurance'),
  ('Debt'),
  ('Entertainment'),
  ('Personal'),
  ('Miscellaneous');

-- Create function to handle user creation
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, name, email)
  VALUES (new.id, new.raw_user_meta_data->>'name', new.email);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user(); 