/**
 * API Route: /api/chat
 * Handles chat interactions with the AI finance coach
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { callOpenAIChat } from '@/lib/openai';
import { savingsGoalAgent } from '@/lib/agents';
import { translateTexts, translateToEnglish } from '@/lib/translate';
import {
  getSavingsGoals,
  createSavingsGoal,
  getUser,
  updateSavingsGoalAmount,
  deleteSavingsGoal,
  updateSavingsGoalRules,
  markSavingsGoalComplete,
  updateSavingsGoal,
} from '@/lib/supabase';
import type { ChatMessage, SavingsGoal } from '@/lib/types';

/**
 * POST /api/chat
 * Processes chat messages and detects intents (savings goals, financial advice)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { conversation, userId = 'demoUser', lang: bodyLang } = body;
    const lang = bodyLang === 'en' ? 'en' : 'de';
    const tr = (de: string, en: string) => (lang === 'en' ? en : de);

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
    const updateIntent = detectGoalUpdateIntent(latestUserMessage, goals);
    const isSavingsGoal = detectSavingsGoalIntent(latestUserMessage);

    let assistantMessage = '';
    let updatedGoals: SavingsGoal[] | undefined;

    if (savingsDepositIntent) {
      try {
        const targetGoal = goals.find((g) => g.id === savingsDepositIntent.goalId);
        if (!targetGoal) {
          assistantMessage = tr(
            'Ich konnte kein passendes Sparziel finden. Nenne mir kurz den Namen deines Ziels, dann buche ich die Einzahlung.',
            'I could not find a matching savings goal. Tell me the goal name and I will record the deposit.'
          );
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

          assistantMessage = tr(
            `Alles klar! Ich habe ${savingsDepositIntent.amount} CHF auf "${updatedGoal.title}" verbucht. Neuer Stand: ${updatedGoal.currentSavedAmount} CHF von ${updatedGoal.targetAmount} CHF (${progress}%).`,
            `Got it! I booked ${savingsDepositIntent.amount} CHF to "${updatedGoal.title}". New balance: ${updatedGoal.currentSavedAmount} CHF of ${updatedGoal.targetAmount} CHF (${progress}%).`
          );
        }
      } catch (error) {
        console.error('Error updating savings goal:', error);
        assistantMessage = tr(
          'Die Einzahlung konnte ich nicht speichern. Bitte versuch es nochmal oder nenne mir den Zielnamen und den Betrag.',
          'I could not save the deposit. Please try again or tell me the goal name and the amount.'
        );
      }
    } else if (ruleAddIntent) {
      try {
        const targetGoal = goals.find((g) => g.id === ruleAddIntent.goalId);
        if (!targetGoal) {
          assistantMessage = tr(
            'Ich habe kein Sparziel gefunden, zu dem ich die Regel hinzufuegen kann.',
            'I could not find a savings goal to add the rule to.'
          );
        } else {
          const newRules = [...targetGoal.rules, ruleAddIntent.ruleText];
          let rulesEn = targetGoal.rulesEn;
          try {
            const translated = await translateToEnglish(ruleAddIntent.ruleText);
            rulesEn = [...(targetGoal.rulesEn ?? targetGoal.rules.map((r) => r)), translated];
          } catch (err) {
            console.error('Error translating added rule:', err);
          }
          await updateSavingsGoalRules(targetGoal.id, newRules, rulesEn);
          updatedGoals = await getSavingsGoals(userId);
          assistantMessage = tr(
            `Ich habe eine neue Regel zu "${targetGoal.title}" hinzugefuegt: "${ruleAddIntent.ruleText}".`,
            `I added a new rule to "${targetGoal.title}": "${ruleAddIntent.ruleText}".`
          );
        }
      } catch (error) {
        console.error('Error adding rule:', error);
        assistantMessage = tr(
          'Die Regel konnte ich nicht speichern. Bitte versuch es erneut.',
          'I could not save the rule. Please try again.'
        );
      }
    } else if (ruleRemoveIntent) {
      try {
        const targetGoal = goals.find((g) => g.id === ruleRemoveIntent.goalId);
        if (!targetGoal) {
          assistantMessage = tr(
            'Ich habe kein Sparziel gefunden, aus dem ich eine Regel entfernen kann.',
            'I could not find a savings goal to remove a rule from.'
          );
        } else {
          const { rules, rulesEn } = targetGoal;
          let newRules = rules;
          let newRulesEn = rulesEn ?? undefined;
          if (typeof ruleRemoveIntent.ruleIndex === 'number' && rules[ruleRemoveIntent.ruleIndex]) {
            newRules = rules.filter((_, idx) => idx !== ruleRemoveIntent.ruleIndex);
            if (newRulesEn) newRulesEn = newRulesEn.filter((_, idx) => idx !== ruleRemoveIntent.ruleIndex);
          } else if (ruleRemoveIntent.ruleText) {
            const ruleText = ruleRemoveIntent.ruleText.toLowerCase();
            newRules = rules.filter((r) => !r.toLowerCase().includes(ruleText));
            if (newRulesEn) newRulesEn = newRulesEn.filter((r, idx) => !rules[idx].toLowerCase().includes(ruleText));
          }

          await updateSavingsGoalRules(targetGoal.id, newRules, newRulesEn);
          updatedGoals = await getSavingsGoals(userId);
          assistantMessage = tr(
            `Regel aktualisiert. "${targetGoal.title}" hat jetzt ${newRules.length} Regeln.`,
            `Rule updated. "${targetGoal.title}" now has ${newRules.length} rules.`
          );
        }
      } catch (error) {
        console.error('Error removing rule:', error);
        assistantMessage = tr(
          'Die Regel konnte ich nicht entfernen. Bitte versuch es erneut.',
          'I could not remove the rule. Please try again.'
        );
      }
    } else if (deleteIntent) {
      try {
        await deleteSavingsGoal(deleteIntent.goalId);
        updatedGoals = await getSavingsGoals(userId);
        assistantMessage = tr(
          `Ich habe das Sparziel "${deleteIntent.goalTitle}" geloescht.`,
          `I deleted the savings goal "${deleteIntent.goalTitle}".`
        );
      } catch (error) {
        console.error('Error deleting goal:', error);
        assistantMessage = tr(
          'Das Sparziel konnte ich nicht loeschen.',
          'I could not delete the savings goal.'
        );
      }
    } else if (completeIntent) {
      try {
        const updated = await markSavingsGoalComplete(completeIntent.goalId);
        updatedGoals = await getSavingsGoals(userId);
        assistantMessage = tr(
          `Glueckwunsch! "${updated.title}" ist jetzt als erreicht markiert (Zielbetrag ${updated.targetAmount} CHF).`,
          `Congrats! "${updated.title}" is now marked as achieved (target ${updated.targetAmount} CHF).`
        );
      } catch (error) {
        console.error('Error completing goal:', error);
        assistantMessage = tr(
          'Ich konnte das Sparziel nicht als erledigt markieren.',
          'I could not mark the savings goal as completed.'
        );
      }
    } else if (updateIntent) {
      try {
        const targetGoal = goals.find((g) => g.id === updateIntent.goalId);
        if (!targetGoal) {
          assistantMessage = tr(
            'Kein passendes Sparziel zum Aktualisieren gefunden.',
            'Could not find a matching savings goal to update.'
          );
        } else {
          const goalOutput = await savingsGoalAgent({
            userMessage: latestUserMessage,
            userId,
          });
          const { goalTitle, rules, rulesEn } = await buildBilingualRules(goalOutput, lang, targetGoal);
          const updated = await updateSavingsGoal(targetGoal.id, {
            title: goalTitle,
            targetAmount: goalOutput.targetAmount,
            targetDate: goalOutput.targetDate,
            rules,
            rulesEn,
          });
          updatedGoals = await getSavingsGoals(userId);
          assistantMessage = tr(
            `Ich habe dein Sparziel "${updated.title}" aktualisiert. Ziel: ${updated.targetAmount} CHF bis ${new Date(updated.targetDate).toLocaleDateString('de-CH')}.`,
            `I updated your savings goal "${updated.title}". Target: ${updated.targetAmount} CHF by ${new Date(updated.targetDate).toLocaleDateString('en-GB')}.`
          );
        }
      } catch (error) {
        console.error('Error updating savings goal:', error);
        assistantMessage = tr(
          'Konnte das Sparziel nicht aktualisieren.',
          'Could not update the savings goal.'
        );
      }
    } else if (isSavingsGoal) {
      // Extract savings goal using SavingsGoalAgent
      try {
        const goalOutput = await savingsGoalAgent({
          userMessage: latestUserMessage,
          userId,
        });

        const { goalTitle, rules, rulesEn } = await buildBilingualRules(goalOutput, lang);

        // Create and save the goal
        const newGoal: SavingsGoal = {
          id: randomUUID(),
          userId,
          title: goalTitle,
          targetAmount: goalOutput.targetAmount,
          targetDate: goalOutput.targetDate,
          currentSavedAmount: 0,
          rules,
          rulesEn,
        };

        await createSavingsGoal(newGoal);

        // Get updated goals list
        updatedGoals = await getSavingsGoals(userId);

        // Generate confirmation message
        const displayRules = lang === 'en' && rulesEn?.length ? rulesEn : rules;
        assistantMessage = tr(
          `Super! Ich habe dein Sparziel "${goalTitle}" erfasst.

Ziel: ${goalOutput.targetAmount} CHF bis ${new Date(goalOutput.targetDate).toLocaleDateString('de-CH')}

Deine Verhaltensregeln:
${displayRules.map((rule, i) => `${i + 1}. ${rule}`).join('\n')}

Bleib fokussiert und tracke regelmaessig deinen Fortschritt.`,
          `Great! I captured your savings goal "${goalTitle}".

Goal: ${goalOutput.targetAmount} CHF by ${new Date(goalOutput.targetDate).toLocaleDateString('en-GB')}

Your rules:
${displayRules.map((rule, i) => `${i + 1}. ${rule}`).join('\n')}

Stay focused and track your progress regularly.`
        );
      } catch (error) {
        console.error('Error processing savings goal:', error);
        assistantMessage = tr(
          'Entschuldigung, ich konnte dein Sparziel nicht verarbeiten. Kannst du es nochmal anders formulieren?',
          'Sorry, I could not process your savings goal. Could you rephrase it?'
        );
      }
    } else {
      // General finance coach conversation
      const user = await getUser(userId);

      // Build system prompt with Kontext und heutigem Datum
      const today = new Date().toISOString().split('T')[0];
      const systemPrompt =
        lang === 'en'
          ? `You are SmartBudgetAI, a friendly but honest personal finance coach. Today is ${today}.

You speak English. You help users reflect on spending and make better financial decisions.

Style:
- Concrete and actionable
- Honest but encouraging
- Use emojis sparingly and only if helpful
- Short, concise answers

User data:
- Monthly net income: ${user?.monthlyNetIncome || 5000} CHF
- Active savings goals: ${goals.length}
${goals
  .map(
    (g) => `  * ${g.title}: ${g.targetAmount} CHF by ${new Date(g.targetDate).toLocaleDateString('en-GB')}`
  )
  .join('\n')}

If the user mentions a savings goal (with amount and timeframe), detect it and respond enthusiastically.`
          : `Du bist SmartBudgetAI, ein freundlicher aber ehrlicher persoenlicher Finanzcoach. Heute ist ${today}.

Du hilfst Nutzern auf Deutsch, ihre Ausgaben zu reflektieren und bessere Finanzentscheidungen zu treffen.

Dein Stil:
- Konkret und actionable
- Ehrlich aber motivierend
- Nutzt relevante Emojis sparsam
- Kurze, prägnante Antworten

Aktuelle Nutzerdaten:
- Monatliches Nettoeinkommen: ${user?.monthlyNetIncome || 5000} CHF
- Aktive Sparziele: ${goals.length}
${goals
  .map(
    (g) => `  * ${g.title}: ${g.targetAmount} CHF bis ${new Date(g.targetDate).toLocaleDateString('de-CH')}`
  )
  .join('\n')}

Wenn der Nutzer über ein Sparziel spricht (mit Betrag und Zeitraum), erkenne das und reagiere enthusiastisch darauf.`;

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
  const goalKeywords = [
    'sparen',
    'sparziel',
    'ziel',
    'spare',
    'save',
    'saving',
    'savings',
    'goal',
    'target',
  ];
  const amountKeywords = ['chf', 'franken', 'fr.', 'eur', 'usd', '$', '€', '£'];
  const timeKeywords = [
    'bis',
    'monat',
    'monate',
    'jahr',
    'jahre',
    'tag',
    'tage',
    'woche',
    'wochen',
    'by',
    'month',
    'months',
    'year',
    'years',
    'week',
    'weeks',
    'day',
    'days',
    'until',
  ];

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

function detectGoalUpdateIntent(
  message: string,
  goals: SavingsGoal[]
): { goalId: string } | null {
  const normalized = normalize(message);
  // Broad keyword set so both DE/EN phrasing is caught when users want to modify an existing goal
  const keywords = [
    'update',
    'updatee',
    'anpassen',
    'pass an',
    'passe',
    'ändere',
    'aendere',
    'ändern',
    'aendern',
    'bearbeiten',
    'edit',
    'adjust',
    'adjustiere',
    'change',
    'modify',
    'revise',
    'rename',
    'updaten',
    'aktualisier',
    'aktualisieren',
    'editieren',
    'rewrite',
    'rework',
    'überarbeiten',
    'ueberarbeiten',
    'überarbeite',
    'ueberarbeite',
    'änderung',
    'aenderung',
    'ziel anpassen',
    'goal update',
    'goal adjust',
    'goal change',
  ];
  const hasKeyword = keywords.some((kw) => normalized.includes(kw));
  if (!hasKeyword) return null;
  const matchedGoal = matchGoalByName(normalized, goals) || goals[0];
  if (!matchedGoal) return null;
  return { goalId: matchedGoal.id };
}

function calculateMonthlyRate(targetAmount: number, targetDate: string): number {
  const today = new Date();
  const target = new Date(targetDate);
  // Count remaining months (at least 1) so we can spread the saving amount evenly
  const months =
    Math.max(
      1,
      (target.getFullYear() - today.getFullYear()) * 12 +
        (target.getMonth() - today.getMonth()) +
        (target.getDate() >= today.getDate() ? 1 : 0)
    );
  return Math.max(0, targetAmount / months);
}

async function buildBilingualRules(
  goalOutput: { goalTitle: string; targetAmount: number; targetDate: string; rules: string[] },
  lang: 'de' | 'en',
  existing?: SavingsGoal
): Promise<{ goalTitle: string; rules: string[]; rulesEn?: string[] }> {
  // Ensure monthly saving is deterministic (not left to the LLM)
  const targetAmount = goalOutput.targetAmount || existing?.targetAmount || 0;
  const targetDate = goalOutput.targetDate || existing?.targetDate || new Date().toISOString().slice(0, 10);

  const monthly = calculateMonthlyRate(targetAmount, targetDate);
  const monthlyRuleDe = `Jeden Monat ${monthly.toFixed(2)} CHF aufs Sparkonto überweisen`;
  const monthlyRuleEn = `Transfer ${monthly.toFixed(2)} CHF to savings each month`;

  // Keep user rules but strip any duplicate monthly rule to avoid double entries
  const baseRules = (goalOutput.rules || []).filter((r) => !r.toLowerCase().includes('aufs sparkonto'));
  const rules = [monthlyRuleDe, ...baseRules];

  let goalTitle = goalOutput.goalTitle;
  let rulesEn: string[] | undefined;

  if (lang === 'en') {
    try {
      // Prefer a batch translation for EN display when the user is in EN
      const translated = await translateTexts([goalOutput.goalTitle, ...baseRules], 'EN');
      if (translated.length === baseRules.length + 1) {
        goalTitle = translated[0];
        rulesEn = [monthlyRuleEn, ...translated.slice(1)];
      }
    } catch (err) {
      console.error('Error translating rules to EN:', err);
    }
  }

  if (!rulesEn) {
    try {
      const translated = await Promise.all(rules.map((r) => translateToEnglish(r)));
      rulesEn = translated;
    } catch (err) {
      console.error('Error translating rules for storage:', err);
    }
  }

  return { goalTitle, rules, rulesEn };
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
