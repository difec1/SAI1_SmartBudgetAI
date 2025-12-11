/**
 * API Route: /api/seed
 * Seeds the database with demo data for MVP testing
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { supabase } from '@/lib/supabase';

/**
 * POST /api/seed
 * Seeds demo user, transactions, and goals
 */
export async function POST(request: NextRequest) {
  try {
    // Check if demo user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('id', 'demoUser')
      .maybeSingle();

    if (existingUser) {
      return NextResponse.json({
        success: true,
        message: 'Demo data already exists',
        alreadySeeded: true,
      });
    }

    // Create demo user
    await supabase.from('users').insert({
      id: 'demoUser',
      name: 'Demo User',
      monthly_net_income: 5500,
    });

    // Create demo transactions
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const demoTransactions = [
      {
        id: randomUUID(),
        user_id: 'demoUser',
        date: `${currentMonth}-05`,
        merchant: 'Coop',
        amount: 87.5,
        category: 'Lebensmittel',
        is_impulse: false,
        decision_label: 'useful',
        decision_explanation: 'Regelmässiger Lebensmitteleinkauf für die Woche.',
      },
      {
        id: randomUUID(),
        user_id: 'demoUser',
        date: `${currentMonth}-06`,
        merchant: 'Zalando',
        amount: 129.9,
        category: 'Shopping',
        is_impulse: true,
        decision_label: 'unnecessary',
        decision_explanation: 'Spontaner Online-Kauf ohne konkreten Bedarf. Klassischer Impulskauf.',
      },
      {
        id: randomUUID(),
        user_id: 'demoUser',
        date: `${currentMonth}-07`,
        merchant: 'SBB',
        amount: 85.0,
        category: 'Transport',
        is_impulse: false,
        decision_label: 'useful',
        decision_explanation: 'Monatliches Bahnabo für den Arbeitsweg.',
      },
      {
        id: randomUUID(),
        user_id: 'demoUser',
        date: `${currentMonth}-08`,
        merchant: 'Uber Eats',
        amount: 42.5,
        category: 'Food Delivery',
        is_impulse: true,
        decision_label: 'unnecessary',
        decision_explanation: 'Späte Essensbestellung aus Bequemlichkeit.',
      },
      {
        id: randomUUID(),
        user_id: 'demoUser',
        date: `${currentMonth}-09`,
        merchant: 'Migros',
        amount: 65.3,
        category: 'Lebensmittel',
        is_impulse: false,
        decision_label: 'useful',
        decision_explanation: 'Wocheneinkauf mit Haushaltsprodukten.',
      },
      {
        id: randomUUID(),
        user_id: 'demoUser',
        date: `${currentMonth}-10`,
        merchant: 'Netflix',
        amount: 19.9,
        category: 'Unterhaltung',
        is_impulse: false,
        decision_label: 'useful',
        decision_explanation: 'Monatliches Streaming-Abo.',
      },
      {
        id: randomUUID(),
        user_id: 'demoUser',
        date: `${currentMonth}-11`,
        merchant: 'H&M',
        amount: 89.5,
        category: 'Shopping',
        is_impulse: true,
        decision_label: 'unnecessary',
        decision_explanation: 'Spontaner Kleiderkauf ohne Planung.',
      },
    ];

    await supabase.from('transactions').insert(demoTransactions);

    // Create demo savings goal
    const targetDate = new Date();
    targetDate.setMonth(targetDate.getMonth() + 10);

    await supabase.from('savings_goals').insert({
      id: randomUUID(),
      user_id: 'demoUser',
      title: 'Thailand Ferien',
      target_amount: 2500,
      target_date: targetDate.toISOString().split('T')[0],
      current_saved_amount: 450,
      rules: [
        'Shopping maximal 300 CHF pro Monat',
        'Food Delivery maximal 2x pro Woche',
        'Vor jedem Kauf über 100 CHF: 24h Bedenkzeit',
        'Jeden Monat 200 CHF aufs Sparkonto überweisen',
      ],
    });

    return NextResponse.json({
      success: true,
      message: 'Demo data seeded successfully',
      seeded: {
        users: 1,
        transactions: demoTransactions.length,
        goals: 1,
      },
    });
  } catch (error) {
    console.error('Error seeding data:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to seed data' },
      { status: 500 }
    );
  }
}
