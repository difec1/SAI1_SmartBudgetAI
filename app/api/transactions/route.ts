/**
 * API Route: /api/transactions
 * Handles transaction management (GET, POST)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTransactions, createTransaction } from '@/lib/supabase';
import { dataExtractionAgent, impulseClassificationAgent } from '@/lib/agents';
import type { DataExtractionInput, Transaction } from '@/lib/types';

/**
 * GET /api/transactions
 * Returns all transactions for the demo user
 */
export async function GET(request: NextRequest) {
  try {
    const userId = 'demoUser';
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
    const body = await request.json();
    const userId = 'demoUser';

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

    // Step 4: Store in database (Strapi would handle this in the future)
    const savedTransaction = await createTransaction(finalTransaction);

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
