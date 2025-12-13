/**
 * Supabase client configuration (server-only)
 * This module provides a singleton Supabase client for server-side operations.
 * In a future Strapi backend, this would be replaced by Strapi's database layer.
 */

import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_URL');
}

if (!supabaseServiceRoleKey) {
  /**
   * Using the anon key here triggers RLS errors (code 42501) when inserting into
   * `transactions` or `savings_goals`. Force a hard error during startup so the
   * developer adds SUPABASE_SERVICE_ROLE_KEY to `.env.local`.
   */
  throw new Error(
    'Missing SUPABASE_SERVICE_ROLE_KEY. Add the service role key to .env.local to bypass RLS for server-side writes.'
  );
}

/**
 * Admin client used by API routes. Uses the service role key when available to bypass
 * RLS for server-side inserts/selects. This client must never be exposed to the browser,
 * hence the server-only directive above.
 */
export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Lightweight auth client (anon key) used to validate JWTs from the Authorization header
const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey || '');

export async function getUserFromRequest(request: NextRequest) {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : null;
  if (!token) {
    throw new Error('Unauthorized');
  }
  const { data, error } = await supabaseAuth.auth.getUser(token);
  if (error || !data.user) {
    throw new Error('Unauthorized');
  }
  return data.user;
}

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

export async function updateTransactionCategory(params: {
  transactionId: string;
  category: string;
  decisionLabel?: 'useful' | 'unnecessary';
  decisionExplanation?: string;
  isImpulse?: boolean;
  rawCategory?: string;
}): Promise<Transaction> {
  const { transactionId, category, decisionLabel, decisionExplanation, isImpulse, rawCategory } = params;

  const { data, error } = await supabase
    .from('transactions')
    .update({
      category,
      decision_label: decisionLabel,
      decision_explanation: decisionExplanation,
      is_impulse: isImpulse,
      raw_category: rawCategory,
    })
    .eq('id', transactionId)
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

export async function getMerchantCategoryHint(userId: string, merchant: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('transactions')
    .select('category')
    .eq('user_id', userId)
    .eq('merchant', merchant)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) throw error;
  if (!data || data.length === 0) return null;

  // mode of categories
  const counts = new Map<string, number>();
  data.forEach((row) => {
    const cat = row.category;
    counts.set(cat, (counts.get(cat) || 0) + 1);
  });

  let topCategory: string | null = null;
  let topCount = 0;
  counts.forEach((count, cat) => {
    if (count > topCount) {
      topCategory = cat;
      topCount = count;
    }
  });

  return topCategory;
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

export async function deleteSavingsGoal(goalId: string): Promise<void> {
  const { error } = await supabase.from('savings_goals').delete().eq('id', goalId);
  if (error) throw error;
}

export async function updateSavingsGoalAmount(goalId: string, newAmount: number): Promise<SavingsGoal> {
  const { data, error } = await supabase
    .from('savings_goals')
    .update({ current_saved_amount: newAmount })
    .eq('id', goalId)
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

export async function updateSavingsGoalRules(goalId: string, rules: string[]): Promise<SavingsGoal> {
  const { data, error } = await supabase
    .from('savings_goals')
    .update({ rules })
    .eq('id', goalId)
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

export async function markSavingsGoalComplete(goalId: string): Promise<SavingsGoal> {
  const { data, error } = await supabase
    .from('savings_goals')
    .select('*')
    .eq('id', goalId)
    .single();

  if (error) throw error;

  const { data: updated, error: updateError } = await supabase
    .from('savings_goals')
    .update({ current_saved_amount: data.target_amount })
    .eq('id', goalId)
    .select()
    .single();

  if (updateError) throw updateError;

  return {
    id: updated.id,
    userId: updated.user_id,
    title: updated.title,
    targetAmount: parseFloat(updated.target_amount),
    targetDate: updated.target_date,
    currentSavedAmount: parseFloat(updated.current_saved_amount),
    rules: updated.rules as string[],
  };
}

export async function updateUserIncome(userId: string, monthlyNetIncome: number): Promise<User> {
  const { data, error } = await supabase
    .from('users')
    .update({ monthly_net_income: monthlyNetIncome })
    .eq('id', userId)
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    name: data.name,
    monthlyNetIncome: parseFloat(data.monthly_net_income),
  };
}
