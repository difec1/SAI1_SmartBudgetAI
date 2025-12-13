/**
 * API Route: /api/goals
 * Handles savings goals retrieval
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSavingsGoals, updateSavingsGoalAmount, deleteSavingsGoal, getUserFromRequest } from '@/lib/supabase';

/**
 * GET /api/goals
 * Returns all savings goals for the demo user
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    const userId = user.id;
    const goals = await getSavingsGoals(userId);

    return NextResponse.json({
      success: true,
      goals,
    });
  } catch (error) {
    console.error('Error fetching goals:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch goals' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/goals
 * Body: { goalId: string, amount: number, mode: 'deposit' }
 */
export async function PATCH(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    const { goalId, amount, mode } = await request.json();
    const userId = user.id;

    if (!goalId || typeof amount !== 'number' || mode !== 'deposit') {
      return NextResponse.json({ success: false, error: 'Invalid payload' }, { status: 400 });
    }

    const goals = await getSavingsGoals(userId);
    const goal = goals.find((g) => g.id === goalId);
    if (!goal) {
      return NextResponse.json({ success: false, error: 'Goal not found' }, { status: 404 });
    }

    const newAmount = Math.max(0, goal.currentSavedAmount + amount);
    const updated = await updateSavingsGoalAmount(goalId, newAmount);
    const updatedGoals = await getSavingsGoals(userId);

    return NextResponse.json({ success: true, goal: updated, goals: updatedGoals });
  } catch (error) {
    console.error('Error updating goal:', error);
    return NextResponse.json({ success: false, error: 'Failed to update goal' }, { status: 500 });
  }
}

/**
 * DELETE /api/goals
 * Body: { goalId: string }
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    const { goalId } = await request.json();
    if (!goalId) {
      return NextResponse.json({ success: false, error: 'goalId required' }, { status: 400 });
    }

    await deleteSavingsGoal(goalId);
    const goals = await getSavingsGoals(user.id);

    return NextResponse.json({ success: true, goals });
  } catch (error) {
    console.error('Error deleting goal:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete goal' }, { status: 500 });
  }
}
