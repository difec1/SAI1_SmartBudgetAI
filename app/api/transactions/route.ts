/**
 * API Route: /api/transactions
 * Handles transaction management (GET, POST)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getTransactions,
  createTransaction,
  getSavingsGoals,
  updateSavingsGoalAmount,
  updateTransactionCategory,
  getMerchantCategoryHint,
  getUserFromRequest,
} from '@/lib/supabase';
import { dataExtractionAgent, impulseClassificationAgent } from '@/lib/agents';
import type { DataExtractionInput, Transaction } from '@/lib/types';

/**
 * GET /api/transactions
 * Returns all transactions for the demo user
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    const userId = user.id;
    const transactions = await getTransactions(userId);

    return NextResponse.json({
      success: true,
      transactions,
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/transactions
 * Creates a new transaction with AI classification
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    const body = await request.json();
    const userId = user.id;
    const { savingsGoalId, allocateAmount } = body;

    // Validate input
    if (!body.merchant || body.amount === undefined) {
      return NextResponse.json(
        { success: false, error: 'Merchant and amount are required' },
        { status: 400 }
      );
    }

    // Step 1: Extract structured data
    const input: DataExtractionInput = {
      date: body.date,
      merchant: body.merchant,
      amount: body.amount,
      rawCategory: body.rawCategory,
      justification: body.justification,
    };

    const extractedTransaction = await dataExtractionAgent(input, userId);

    // Optional historical hint: if no rawCategory provided, use most frequent category for this merchant
    if (!extractedTransaction.rawCategory) {
      const hint = await getMerchantCategoryHint(userId, extractedTransaction.merchant);
      if (hint) {
        extractedTransaction.rawCategory = hint;
      }
    }

    // Step 2: Classify with AI (category, impulse, decision)
    const classification = await impulseClassificationAgent({
      transaction: extractedTransaction,
    });

    // Step 3: Combine and create final transaction
    const finalTransaction: Transaction = {
      ...extractedTransaction,
      category: classification.category,
      isImpulse: classification.isImpulse,
      decisionLabel: classification.decisionLabel,
      decisionExplanation: classification.decisionExplanation,
    };

    // Override for income-like transactions: treat as Einnahmen (positive inflow)
    if (isIncomeTransaction(finalTransaction)) {
      finalTransaction.category = 'Einnahmen';
      finalTransaction.isImpulse = false;
      finalTransaction.decisionLabel = 'useful';
      finalTransaction.decisionExplanation = 'Einnahme verbucht (z.B. Lohn/Salär).';
    }

    // Step 4: Store in database (Strapi would handle this in the future)
    const savedTransaction = await createTransaction(finalTransaction);

    // Optional: allocate amount to savings goal
    if (savingsGoalId && typeof allocateAmount === 'number' && allocateAmount > 0) {
      await allocateToGoal(savingsGoalId, allocateAmount, userId);
    }

    return NextResponse.json({
      success: true,
      transaction: savedTransaction,
    });
  } catch (error) {
    console.error('Error creating transaction:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create transaction' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/transactions
 * Body: { id: string, category: string, decisionLabel?, decisionExplanation?, isImpulse? }
 */
export async function PATCH(request: NextRequest) {
  try {
    await getUserFromRequest(request);
    const body = await request.json();
    const { id, category, decisionLabel, decisionExplanation, isImpulse } = body;
    if (!id || !category) {
      return NextResponse.json({ success: false, error: 'id und category sind erforderlich' }, { status: 400 });
    }

    const updated = await updateTransactionCategory({
      transactionId: id,
      category,
      decisionLabel,
      decisionExplanation,
      isImpulse,
      rawCategory: category, // store user override as hint
    });

    return NextResponse.json({ success: true, transaction: updated });
  } catch (error) {
    console.error('Error updating transaction category:', error);
    return NextResponse.json({ success: false, error: 'Failed to update transaction' }, { status: 500 });
  }
}

async function allocateToGoal(goalId: string, amount: number, userId: string) {
  const goals = await getSavingsGoals(userId);
  const goal = goals.find((g) => g.id === goalId);
  if (!goal) return;

  const newAmount = Math.max(0, goal.currentSavedAmount + amount);
  await updateSavingsGoalAmount(goalId, newAmount);
}

function isIncomeTransaction(transaction: Transaction): boolean {
  const fields = [
    transaction.merchant,
    transaction.rawCategory || '',
    transaction.justification || '',
  ].join(' ').toLowerCase();

  const incomeKeywords = ['lohn', 'salär', 'gehalt', 'salary', 'payroll', 'einkommen', 'bonus', 'wage'];

  return incomeKeywords.some((kw) => fields.includes(kw));
}
