/**
 * Supabase client configuration (server-only)
 * This module provides a singleton Supabase client for server-side operations.
 * In a future Strapi backend, this would be replaced by Strapi's database layer.
 */

import 'server-only';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_URL');
}

if (!supabaseServiceRoleKey && !supabaseAnonKey) {
  throw new Error('Missing Supabase credentials. Set SUPABASE_SERVICE_ROLE_KEY (recommended) or NEXT_PUBLIC_SUPABASE_ANON_KEY.');
}

/**
 * Admin client used by API routes. Uses the service role key when available to bypass
 * RLS for server-side inserts/selects. This client must never be exposed to the browser,
 * hence the server-only directive above.
 */
export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey || supabaseAnonKey!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/**
 * Database helper functions
 * These abstract the data access layer for easy migration to Strapi later.
 */

import type { User, Transaction, SavingsGoal } from './types';

// Users
export async function getUser(userId: string): Promise<User | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    id: data.id,
    name: data.name,
    monthlyNetIncome: parseFloat(data.monthly_net_income),
  };
}

export async function createUser(user: User): Promise<User> {
  const { data, error } = await supabase
    .from('users')
    .insert({
      id: user.id,
      name: user.name,
      monthly_net_income: user.monthlyNetIncome,
    })
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    name: data.name,
    monthlyNetIncome: parseFloat(data.monthly_net_income),
  };
}

// Transactions
export async function getTransactions(userId: string): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false });

  if (error) throw error;

  return (data || []).map((row) => ({
    id: row.id,
    userId: row.user_id,
    date: row.date,
    merchant: row.merchant,
    amount: parseFloat(row.amount),
    rawCategory: row.raw_category,
    category: row.category,
    justification: row.justification,
    isImpulse: row.is_impulse,
    decisionLabel: row.decision_label as 'useful' | 'unnecessary',
    decisionExplanation: row.decision_explanation,
  }));
}

export async function createTransaction(transaction: Transaction): Promise<Transaction> {
  const { data, error } = await supabase
    .from('transactions')
    .insert({
      id: transaction.id,
      user_id: transaction.userId,
      date: transaction.date,
      merchant: transaction.merchant,
      amount: transaction.amount,
      raw_category: transaction.rawCategory,
      category: transaction.category,
      justification: transaction.justification,
      is_impulse: transaction.isImpulse,
      decision_label: transaction.decisionLabel,
      decision_explanation: transaction.decisionExplanation,
    })
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    userId: data.user_id,
    date: data.date,
    merchant: data.merchant,
    amount: parseFloat(data.amount),
    rawCategory: data.raw_category,
    category: data.category,
    justification: data.justification,
    isImpulse: data.is_impulse,
    decisionLabel: data.decision_label as 'useful' | 'unnecessary',
    decisionExplanation: data.decision_explanation,
  };
}

// Savings Goals
export async function getSavingsGoals(userId: string): Promise<SavingsGoal[]> {
  const { data, error } = await supabase
    .from('savings_goals')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data || []).map((row) => ({
    id: row.id,
    userId: row.user_id,
    title: row.title,
    targetAmount: parseFloat(row.target_amount),
    targetDate: row.target_date,
    currentSavedAmount: parseFloat(row.current_saved_amount),
    rules: row.rules as string[],
  }));
}

export async function createSavingsGoal(goal: SavingsGoal): Promise<SavingsGoal> {
  const { data, error } = await supabase
    .from('savings_goals')
    .insert({
      id: goal.id,
      user_id: goal.userId,
      title: goal.title,
      target_amount: goal.targetAmount,
      target_date: goal.targetDate,
      current_saved_amount: goal.currentSavedAmount,
      rules: goal.rules,
    })
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    userId: data.user_id,
    title: data.title,
    targetAmount: parseFloat(data.target_amount),
    targetDate: data.target_date,
    currentSavedAmount: parseFloat(data.current_saved_amount),
    rules: data.rules as string[],
  };
}
