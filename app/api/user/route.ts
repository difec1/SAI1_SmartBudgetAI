import { NextRequest, NextResponse } from 'next/server';
import { getUser, updateUserIncome, getUserFromRequest } from '@/lib/supabase';

/**
 * PATCH /api/user
 * Updates the user's monthly net income (used to derive the flexible monthly budget)
 * Body: { monthlyBudget: number }  // flexible budget amount
 */
export async function PATCH(request: NextRequest) {
  try {
    const authUser = await getUserFromRequest(request);
    const { monthlyBudget } = await request.json();
    const userId = authUser.id;

    if (monthlyBudget === undefined || Number.isNaN(Number(monthlyBudget))) {
      return NextResponse.json(
        { success: false, error: 'monthlyBudget is required' },
        { status: 400 }
      );
    }

    const user = await getUser(userId);
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    // The app uses 60% of net income as flexible budget. Convert back.
    const monthlyNetIncome = Math.max(0, Number(monthlyBudget) / 0.6);
    const updatedUser = await updateUserIncome(userId, monthlyNetIncome);

    return NextResponse.json({
      success: true,
      user: updatedUser,
      monthlyBudget: monthlyBudget,
    });
  } catch (error) {
    console.error('Error updating user budget:', error);
    return NextResponse.json({ success: false, error: 'Failed to update budget' }, { status: 500 });
  }
}
