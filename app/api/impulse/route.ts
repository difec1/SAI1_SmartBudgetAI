import { NextRequest, NextResponse } from 'next/server';
import { callOpenAI } from '@/lib/openai';
import {
  getTransactions,
  updateTransactionCategory,
} from '@/lib/supabase';
import { translateToEnglish } from '@/lib/translate';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { transactionId, justification } = body || {};

    if (!transactionId) {
      return NextResponse.json({ success: false, error: 'transactionId is required' }, { status: 400 });
    }

    const userId = 'demoUser';
    const transactions = await getTransactions(userId);
    const tx = transactions.find((t) => t.id === transactionId);
    if (!tx) {
      return NextResponse.json({ success: false, error: 'Transaction not found' }, { status: 404 });
    }

    const systemPrompt = `Du bist ein Finanzcoach. Entscheide, ob ein Kauf ein Impulskauf ist.
Antworte nur als kompaktes JSON: {"isImpulse": boolean, "decisionLabel": "useful"|"unnecessary", "decisionExplanation": string, "category": string}

Kontext:
- isImpulse = true, wenn der Kauf nicht geplant/unnötig war.
- decisionLabel = "useful" für sinnvolle Ausgaben, sonst "unnecessary".
- decisionExplanation auf Deutsch, kurz und spezifisch.
`;

    const userPrompt = `Transaktion:
- Händler: ${tx.merchant}
- Betrag: ${tx.amount} CHF
- Datum: ${tx.date}
- Aktuelle Kategorie: ${tx.category}
- Urspr. Begründung: ${tx.justification ?? 'keine'}
- Nutzer-Kommentar: ${justification ?? 'keiner'}

Bitte klassifiziere neu.`;

    let aiResult: { isImpulse?: boolean; decisionLabel?: 'useful' | 'unnecessary'; decisionExplanation?: string; category?: string } = {};
    try {
      const raw = await callOpenAI(systemPrompt, userPrompt, 0.2);
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        aiResult = JSON.parse(jsonMatch[0]);
      }
    } catch (err) {
      console.error('Error calling OpenAI for impulse justification:', err);
    }

    let decisionExplanationEn: string | undefined;
    if (aiResult.decisionExplanation) {
      try {
        decisionExplanationEn = await translateToEnglish(aiResult.decisionExplanation);
      } catch (err) {
        console.error('Error translating impulse decision explanation:', err);
      }
    }

    const updated = await updateTransactionCategory({
      transactionId: tx.id,
      category: aiResult.category || tx.category,
      decisionLabel: aiResult.decisionLabel || tx.decisionLabel,
      decisionExplanation:
        aiResult.decisionExplanation || justification || tx.decisionExplanation,
      decisionExplanationEn: decisionExplanationEn || tx.decisionExplanationEn,
      isImpulse: typeof aiResult.isImpulse === 'boolean' ? aiResult.isImpulse : tx.isImpulse,
      rawCategory: aiResult.category || tx.category,
    });

    return NextResponse.json({ success: true, transaction: updated });
  } catch (error) {
    console.error('Error processing impulse justification:', error);
    return NextResponse.json({ success: false, error: 'Failed to process justification' }, { status: 500 });
  }
}
