/*
  # Create SmartBudgetAI tables

  1. New Tables
    - `users`
      - `id` (text, primary key) - User identifier
      - `name` (text) - User's name
      - `monthly_net_income` (numeric) - User's monthly net income in CHF
      - `created_at` (timestamptz) - Record creation timestamp
      
    - `transactions`
      - `id` (uuid, primary key) - Transaction identifier
      - `user_id` (text, foreign key) - Reference to users table
      - `date` (text) - Transaction date
      - `merchant` (text) - Merchant name
      - `amount` (numeric) - Transaction amount in CHF
      - `raw_category` (text, nullable) - User-provided category
      - `category` (text) - AI-classified category
      - `justification` (text, nullable) - User's justification
      - `is_impulse` (boolean) - Whether transaction is an impulse purchase
      - `decision_label` (text) - "useful" or "unnecessary"
      - `decision_explanation` (text) - AI-generated explanation
      - `created_at` (timestamptz) - Record creation timestamp
      
    - `savings_goals`
      - `id` (uuid, primary key) - Goal identifier
      - `user_id` (text, foreign key) - Reference to users table
      - `title` (text) - Goal title
      - `target_amount` (numeric) - Target amount in CHF
      - `target_date` (text) - Target date
      - `current_saved_amount` (numeric) - Current saved amount
      - `rules` (jsonb) - Array of behavior rules
      - `created_at` (timestamptz) - Record creation timestamp

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated access (for demo, we'll use permissive policies)
*/

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  name text NOT NULL,
  monthly_net_income numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to users"
  ON users
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date text NOT NULL,
  merchant text NOT NULL,
  amount numeric NOT NULL,
  raw_category text,
  category text NOT NULL DEFAULT '',
  justification text,
  is_impulse boolean NOT NULL DEFAULT false,
  decision_label text NOT NULL DEFAULT 'useful',
  decision_explanation text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to transactions"
  ON transactions
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create savings_goals table
CREATE TABLE IF NOT EXISTS savings_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  target_amount numeric NOT NULL,
  target_date text NOT NULL,
  current_saved_amount numeric NOT NULL DEFAULT 0,
  rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE savings_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to savings_goals"
  ON savings_goals
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_savings_goals_user_id ON savings_goals(user_id);