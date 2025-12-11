/**
 * API Route: /api/analysis
 * Provides budget analysis, patterns, and insights
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUser, getTransactions, getSavingsGoals } from '@/lib/supabase';
import { budgetPlannerAgent } from '@/lib/agents';

/**
 * GET /api/analysis
 * Returns comprehensive budget analysis for the current month
 */
export async function GET(request: NextRequest) {
  try {
    const userId = 'demoUser';

    // Fetch user data
    const user = await getUser(userId);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Fetch transactions and goals
    const transactions = await getTransactions(userId);
    const goals = await getSavingsGoals(userId);

    // Get current month
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Run budget planner agent
    const budgetSummary = await budgetPlannerAgent({
      userId,
      monthlyNetIncome: user.monthlyNetIncome,
      transactions,
      month: currentMonth,
    });

    // Filter impulse purchases for current month
    const impulseTransactions = transactions.filter(
      (t) => t.isImpulse && t.date.startsWith(currentMonth)
    );

    return NextResponse.json({
      success: true,
      budgetSummary: {
        userId,
        month: currentMonth,
        monthlyBudget: budgetSummary.monthlyBudget,
        usedBudget: budgetSummary.usedBudget,
        byCategory: budgetSummary.byCategory,
      },
      impulseTransactions,
      goals,
      patterns: budgetSummary.patterns,
    });
  } catch (error) {
    console.error('Error generating analysis:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate analysis' },
      { status: 500 }
    );
  }
}
