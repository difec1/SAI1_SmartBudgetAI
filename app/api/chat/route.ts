/**
 * API Route: /api/chat
 * Handles chat interactions with the AI finance coach
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { callOpenAIChat } from '@/lib/openai';
import { savingsGoalAgent } from '@/lib/agents';
import { getSavingsGoals, createSavingsGoal, getUser } from '@/lib/supabase';
import type { ChatMessage, SavingsGoal } from '@/lib/types';

/**
 * POST /api/chat
 * Processes chat messages and detects intents (savings goals, financial advice)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { conversation, userId = 'demoUser' } = body;

    if (!conversation || !Array.isArray(conversation)) {
      return NextResponse.json(
        { success: false, error: 'Invalid conversation format' },
        { status: 400 }
      );
    }

    // Get the latest user message
    const userMessages = conversation.filter((m: ChatMessage) => m.role === 'user');
    const latestUserMessage = userMessages[userMessages.length - 1]?.content || '';

    // Intent detection: Check if user is setting a savings goal
    const isSavingsGoal = detectSavingsGoalIntent(latestUserMessage);

    let assistantMessage = '';
    let updatedGoals: SavingsGoal[] | undefined;

    if (isSavingsGoal) {
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
        assistantMessage = `Super! Ich habe dein Sparziel "${goalOutput.goalTitle}" erfasst. 🎯

**Ziel:** ${goalOutput.targetAmount} CHF bis ${new Date(goalOutput.targetDate).toLocaleDateString('de-CH')}

**Deine Verhaltensregeln:**
${goalOutput.rules.map((rule, i) => `${i + 1}. ${rule}`).join('\n')}

Bleib fokussiert und tracke regelmässig deinen Fortschritt. Du schaffst das! 💪`;
      } catch (error) {
        console.error('Error processing savings goal:', error);
        assistantMessage = 'Entschuldigung, ich konnte dein Sparziel nicht verarbeiten. Kannst du es nochmal anders formulieren?';
      }
    } else {
      // General finance coach conversation
      const user = await getUser(userId);
      const goals = await getSavingsGoals(userId);

      // Build system prompt with context
      const systemPrompt = `Du bist SmartBudgetAI, ein freundlicher aber ehrlicher persönlicher Finanzcoach.

Du hilfst Nutzern auf Deutsch, ihre Ausgaben zu reflektieren und bessere Finanzentscheidungen zu treffen.

Dein Stil:
- Konkret und actionable
- Ehrlich aber motivierend
- Nutzt relevante Emojis sparsam
- Kurze, prägnante Antworten

Aktuelle Nutzerdaten:
- Monatliches Nettoeinkommen: ${user?.monthlyNetIncome || 5000} CHF
- Aktive Sparziele: ${goals.length}
${goals.map((g) => `  * ${g.title}: ${g.targetAmount} CHF bis ${new Date(g.targetDate).toLocaleDateString('de-CH')}`).join('\n')}

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
  const lowerMessage = message.toLowerCase();

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
