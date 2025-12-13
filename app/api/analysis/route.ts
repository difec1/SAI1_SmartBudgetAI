/**
 * API Route: /api/analysis
 * Provides budget analysis, patterns, and insights
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUser, getTransactions, getSavingsGoals, getUserFromRequest } from '@/lib/supabase';
import { budgetPlannerAgent } from '@/lib/agents';

/**
 * GET /api/analysis
 * Returns comprehensive budget analysis for the current month
 */
export async function GET(request: NextRequest) {
  try {
    const authUser = await getUserFromRequest(request);
    const userId = authUser.id;

    const { searchParams } = new URL(request.url);
    const timeframeParam = searchParams.get('scope');
    const budgetModeParam = searchParams.get('budgetMode');
    const startDateParam = searchParams.get('startDate') || undefined;
    const endDateParam = searchParams.get('endDate') || undefined;
    const hasCustomRange = Boolean(startDateParam && endDateParam);
    const timeframe = hasCustomRange ? 'custom' : timeframeParam === 'year' ? 'year' : 'month';
    const budgetMode = budgetModeParam === 'manual' ? 'manual' : 'auto';

    // Nutzer und Daten laden
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
    const currentYearPrefix = `${now.getFullYear()}`;

    // Run budget planner agent mit passendem Zeitraum
    const budgetSummary = await budgetPlannerAgent({
      userId,
      monthlyNetIncome: user.monthlyNetIncome,
      transactions,
      month: currentMonth,
      timeframe,
      budgetMode,
      startDate: startDateParam,
      endDate: endDateParam,
    });

    // Impulskäufe für gewählten Zeitraum filtern
    const impulseTransactions = transactions.filter((t) => {
      if (!t.isImpulse) return false;
      if (timeframe === 'year') {
        return t.date.startsWith(currentYearPrefix);
      }
      if (timeframe === 'custom' && startDateParam && endDateParam) {
        return t.date >= startDateParam && t.date <= endDateParam;
      }
      return t.date.startsWith(currentMonth);
    });

    return NextResponse.json({
      success: true,
      budgetSummary: {
        userId,
        month: currentMonth,
        monthlyBudget: budgetSummary.monthlyBudget,
        usedBudget: budgetSummary.usedBudget,
        byCategory: budgetSummary.byCategory,
        timeframe: budgetSummary.timeframe,
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
