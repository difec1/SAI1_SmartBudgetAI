/**
 * API Route: /api/chat
 * Handles chat interactions with the AI finance coach
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { callOpenAIChat } from '@/lib/openai';
import { savingsGoalAgent } from '@/lib/agents';
import {
  getSavingsGoals,
  createSavingsGoal,
  getUser,
  updateSavingsGoalAmount,
  deleteSavingsGoal,
  updateSavingsGoalRules,
  markSavingsGoalComplete,
  getUserFromRequest,
} from '@/lib/supabase';
import type { ChatMessage, SavingsGoal } from '@/lib/types';

/**
 * POST /api/chat
 * Processes chat messages and detects intents (savings goals, financial advice)
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    const userId = user.id;
    const body = await request.json();
    const { conversation } = body;

    if (!conversation || !Array.isArray(conversation)) {
      return NextResponse.json(
        { success: false, error: 'Invalid conversation format' },
        { status: 400 }
      );
    }

    // Get the latest user message
    const userMessages = conversation.filter((m: ChatMessage) => m.role === 'user');
    const latestUserMessage = userMessages[userMessages.length - 1]?.content || '';
    const goals = await getSavingsGoals(userId);

    const savingsDepositIntent = detectSavingsDepositIntent(latestUserMessage, goals);
    const ruleAddIntent = detectGoalRuleAddIntent(latestUserMessage, goals);
    const ruleRemoveIntent = detectGoalRuleRemoveIntent(latestUserMessage, goals);
    const deleteIntent = detectGoalDeletionIntent(latestUserMessage, goals);
    const completeIntent = detectGoalCompleteIntent(latestUserMessage, goals);
    const isSavingsGoal = detectSavingsGoalIntent(latestUserMessage);

    let assistantMessage = '';
    let updatedGoals: SavingsGoal[] | undefined;

    if (savingsDepositIntent) {
      try {
        const targetGoal = goals.find((g) => g.id === savingsDepositIntent.goalId);
        if (!targetGoal) {
          assistantMessage =
            'Ich konnte kein passendes Sparziel finden. Nenne mir kurz den Namen deines Ziels, dann buche ich die Einzahlung.';
        } else {
          const newAmount = Math.max(
            0,
            targetGoal.currentSavedAmount + savingsDepositIntent.amount
          );

          const updatedGoal = await updateSavingsGoalAmount(targetGoal.id, newAmount);
          updatedGoals = await getSavingsGoals(userId);

          const progress = Math.min(
            100,
            Math.round((updatedGoal.currentSavedAmount / updatedGoal.targetAmount) * 100)
          );

          assistantMessage = `Alles klar! Ich habe ${savingsDepositIntent.amount} CHF auf "${updatedGoal.title}" verbucht. Neuer Stand: ${updatedGoal.currentSavedAmount} CHF von ${updatedGoal.targetAmount} CHF (${progress}%).`;
        }
      } catch (error) {
        console.error('Error updating savings goal:', error);
        assistantMessage =
          'Die Einzahlung konnte ich nicht speichern. Bitte versuch es nochmal oder nenne mir den Zielnamen und den Betrag.';
      }
    } else if (ruleAddIntent) {
      try {
        const targetGoal = goals.find((g) => g.id === ruleAddIntent.goalId);
        if (!targetGoal) {
          assistantMessage = 'Ich habe kein Sparziel gefunden, zu dem ich die Regel hinzufuegen kann.';
        } else {
          const newRules = [...targetGoal.rules, ruleAddIntent.ruleText];
          await updateSavingsGoalRules(targetGoal.id, newRules);
          updatedGoals = await getSavingsGoals(userId);
          assistantMessage = `Ich habe eine neue Regel zu "${targetGoal.title}" hinzugefuegt: "${ruleAddIntent.ruleText}".`;
        }
      } catch (error) {
        console.error('Error adding rule:', error);
        assistantMessage = 'Die Regel konnte ich nicht speichern. Bitte versuch es erneut.';
      }
    } else if (ruleRemoveIntent) {
      try {
        const targetGoal = goals.find((g) => g.id === ruleRemoveIntent.goalId);
        if (!targetGoal) {
          assistantMessage = 'Ich habe kein Sparziel gefunden, aus dem ich eine Regel entfernen kann.';
        } else {
          const { rules } = targetGoal;
          let newRules = rules;
          if (typeof ruleRemoveIntent.ruleIndex === 'number' && rules[ruleRemoveIntent.ruleIndex]) {
            newRules = rules.filter((_, idx) => idx !== ruleRemoveIntent.ruleIndex);
          } else if (ruleRemoveIntent.ruleText) {
            const ruleText = ruleRemoveIntent.ruleText.toLowerCase();
            newRules = rules.filter((r) => !r.toLowerCase().includes(ruleText));
          }

          await updateSavingsGoalRules(targetGoal.id, newRules);
          updatedGoals = await getSavingsGoals(userId);
          assistantMessage = `Regel aktualisiert. "${targetGoal.title}" hat jetzt ${newRules.length} Regeln.`;
        }
      } catch (error) {
        console.error('Error removing rule:', error);
        assistantMessage = 'Die Regel konnte ich nicht entfernen. Bitte versuch es erneut.';
      }
    } else if (deleteIntent) {
      try {
        await deleteSavingsGoal(deleteIntent.goalId);
        updatedGoals = await getSavingsGoals(userId);
        assistantMessage = `Ich habe das Sparziel "${deleteIntent.goalTitle}" geloescht.`;
      } catch (error) {
        console.error('Error deleting goal:', error);
        assistantMessage = 'Das Sparziel konnte ich nicht loeschen.';
      }
    } else if (completeIntent) {
      try {
        const updated = await markSavingsGoalComplete(completeIntent.goalId);
        updatedGoals = await getSavingsGoals(userId);
        assistantMessage = `Glueckwunsch! "${updated.title}" ist jetzt als erreicht markiert (Zielbetrag ${updated.targetAmount} CHF).`;
      } catch (error) {
        console.error('Error completing goal:', error);
        assistantMessage = 'Ich konnte das Sparziel nicht als erledigt markieren.';
      }
    } else if (isSavingsGoal) {
      // Extract savings goal using SavingsGoalAgent
      try {
        const goalOutput = await savingsGoalAgent({
          userMessage: latestUserMessage,
          userId,
        });

        // Create and save the goal
        const newGoal: SavingsGoal = {
          id: randomUUID(),
          userId,
          title: goalOutput.goalTitle,
          targetAmount: goalOutput.targetAmount,
          targetDate: goalOutput.targetDate,
          currentSavedAmount: 0,
          rules: goalOutput.rules,
        };

        await createSavingsGoal(newGoal);

        // Get updated goals list
        updatedGoals = await getSavingsGoals(userId);

        // Generate confirmation message
        assistantMessage = `Super! Ich habe dein Sparziel "${goalOutput.goalTitle}" erfasst.

Ziel: ${goalOutput.targetAmount} CHF bis ${new Date(goalOutput.targetDate).toLocaleDateString('de-CH')}

Deine Verhaltensregeln:
${goalOutput.rules.map((rule, i) => `${i + 1}. ${rule}`).join('\n')}

Bleib fokussiert und tracke regelmaessig deinen Fortschritt.`;
      } catch (error) {
        console.error('Error processing savings goal:', error);
        assistantMessage = 'Entschuldigung, ich konnte dein Sparziel nicht verarbeiten. Kannst du es nochmal anders formulieren?';
      }
    } else {
      // General finance coach conversation
      const user = await getUser(userId);

      // Build system prompt with Kontext und heutigem Datum
      const today = new Date().toISOString().split('T')[0];
      const systemPrompt = `Du bist SmartBudgetAI, ein freundlicher aber ehrlicher persoenlicher Finanzcoach. Heute ist ${today}.

Du hilfst Nutzern auf Deutsch, ihre Ausgaben zu reflektieren und bessere Finanzentscheidungen zu treffen.

Dein Stil:
- Konkret und actionable
- Ehrlich aber motivierend
- Nutzt relevante Emojis sparsam
- Kurze, praegnanter Antworten

Aktuelle Nutzerdaten:
- Monatliches Nettoeinkommen: ${user?.monthlyNetIncome || 5000} CHF
- Aktive Sparziele: ${goals.length}
${goals.map((g) => `  * ${g.title}: ${g.targetAmount} CHF bis ${new Date(g.targetDate).toLocaleDateString('de-CH')}`).join('\n')}

Wenn der Nutzer ueber ein Sparziel spricht (mit Betrag und Zeitraum), erkenne das und reagiere enthusiastisch darauf.`;

      // Add system message to conversation
      const messagesWithSystem: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        ...conversation,
      ];

      assistantMessage = await callOpenAIChat(messagesWithSystem, 0.7);
    }

    return NextResponse.json({
      success: true,
      assistantMessage,
      updatedGoals,
    });
  } catch (error) {
    console.error('Error processing chat:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process chat message' },
      { status: 500 }
    );
  }
}

/**
 * Detect if user message contains savings goal intent
 * Simple keyword-based detection (could be enhanced with ML)
 */
function detectSavingsGoalIntent(message: string): boolean {
  const lowerMessage = normalize(message);

  // Keywords that indicate savings goal
  const goalKeywords = ['sparen', 'sparziel', 'ziel', 'spare'];
  const amountKeywords = ['chf', 'franken', 'fr.'];
  const timeKeywords = ['bis', 'monat', 'monate', 'jahr', 'jahre', 'tag', 'tage', 'woche', 'wochen'];

  const hasGoalKeyword = goalKeywords.some((kw) => lowerMessage.includes(kw));
  const hasAmountKeyword = amountKeywords.some((kw) => lowerMessage.includes(kw)) || /\d+/.test(message);
  const hasTimeKeyword = timeKeywords.some((kw) => lowerMessage.includes(kw));

  // Must have at least goal keyword + (amount or time)
  return hasGoalKeyword && (hasAmountKeyword || hasTimeKeyword);
}

/**
 * Detects deposit/Einzahlung for existing savings goals and returns the amount + chosen goal
 */
function detectSavingsDepositIntent(
  message: string,
  goals: SavingsGoal[]
): { amount: number; goalId: string; goalTitle: string } | null {
  const normalized = normalize(message);
  const depositKeywords = ['eingezahlt', 'einbezahlt', 'einzahlung', 'zurueckgelegt', 'gespart'];

  const hasDepositKeyword = depositKeywords.some((kw) => normalized.includes(kw));
  const amountMatch = message.match(/(\d+(?:[.,]\d{1,2})?)/);
  if (!hasDepositKeyword || !amountMatch) return null;

  const amount = parseFloat(amountMatch[1].replace(',', '.'));
  if (Number.isNaN(amount) || amount <= 0) return null;

  const matchedGoal = matchGoalByName(normalized, goals);
  if (!matchedGoal) return null;

  return { amount, goalId: matchedGoal.id, goalTitle: matchedGoal.title };
}

function detectGoalRuleAddIntent(
  message: string,
  goals: SavingsGoal[]
): { goalId: string; ruleText: string } | null {
  const normalized = normalize(message);
  const keywords = ['regel hinzuf', 'neue regel', 'regel add', 'regel dazu'];
  const hasKeyword = keywords.some((kw) => normalized.includes(kw));
  if (!hasKeyword) return null;

  const ruleMatch = message.match(/regel[^:]*[:\-]\s*["“]?(.+?)["”]?$/i) || message.match(/"(.+?)"/);
  const ruleText = ruleMatch ? ruleMatch[1].trim() : '';
  if (!ruleText) return null;

  const matchedGoal = matchGoalByName(normalized, goals) || goals[0];
  if (!matchedGoal) return null;

  return { goalId: matchedGoal.id, ruleText };
}

function detectGoalRuleRemoveIntent(
  message: string,
  goals: SavingsGoal[]
): { goalId: string; ruleIndex?: number; ruleText?: string } | null {
  const normalized = normalize(message);
  const keywords = ['regel loesch', 'regel entfern', 'regel streich'];
  const hasKeyword = keywords.some((kw) => normalized.includes(kw));
  if (!hasKeyword) return null;

  const matchedGoal = matchGoalByName(normalized, goals) || goals[0];
  if (!matchedGoal) return null;

  const indexMatch = message.match(/regel\s*(\d+)/i);
  if (indexMatch) {
    const idx = parseInt(indexMatch[1], 10) - 1;
    if (!Number.isNaN(idx)) {
      return { goalId: matchedGoal.id, ruleIndex: idx };
    }
  }

  const textMatch = message.match(/regel[^:]*[:\-]\s*["“]?(.+?)["”]?$/i) || message.match(/"(.+?)"/);
  const ruleText = textMatch ? textMatch[1].trim() : '';
  return { goalId: matchedGoal.id, ruleText: ruleText || undefined };
}

function detectGoalDeletionIntent(
  message: string,
  goals: SavingsGoal[]
): { goalId: string; goalTitle: string } | null {
  const normalized = normalize(message);
  const keywords = ['loesch', 'delete', 'entfern', 'weg'];
  const hasKeyword = keywords.some((kw) => normalized.includes(kw));
  if (!hasKeyword) return null;

  const matchedGoal = matchGoalByName(normalized, goals) || goals[0];
  if (!matchedGoal) return null;

  return { goalId: matchedGoal.id, goalTitle: matchedGoal.title };
}

function detectGoalCompleteIntent(
  message: string,
  goals: SavingsGoal[]
): { goalId: string; goalTitle: string } | null {
  const normalized = normalize(message);
  const keywords = ['fertig', 'erreicht', 'abgeschlossen', 'erfuellt', 'erledigt'];
  const hasKeyword = keywords.some((kw) => normalized.includes(kw));
  if (!hasKeyword) return null;

  const matchedGoal = matchGoalByName(normalized, goals) || goals[0];
  if (!matchedGoal) return null;

  return { goalId: matchedGoal.id, goalTitle: matchedGoal.title };
}

function matchGoalByName(normalizedMessage: string, goals: SavingsGoal[]): SavingsGoal | undefined {
  return goals.find((g) => normalizedMessage.includes(normalize(g.title)));
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss');
}

