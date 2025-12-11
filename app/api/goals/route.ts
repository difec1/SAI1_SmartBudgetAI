/**
 * API Route: /api/goals
 * Handles savings goals retrieval
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSavingsGoals } from '@/lib/supabase';

/**
 * GET /api/goals
 * Returns all savings goals for the demo user
 */
export async function GET(request: NextRequest) {
  try {
    const userId = 'demoUser';
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
