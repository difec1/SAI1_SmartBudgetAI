/**
 * OpenAI helper module
 * This module abstracts OpenAI API calls for easy replacement or mocking.
 * In production, ensure OPENAI_API_KEY is set in environment variables.
 */

import type { ChatMessage } from './types';

/**
 * Call OpenAI with a system prompt and user prompt
 * @param systemPrompt - Instructions for the AI model
 * @param userPrompt - The user's input or query
 * @param temperature - Controls randomness (0-1)
 * @returns The AI's response text
 */
export async function callOpenAI(
  systemPrompt: string,
  userPrompt: string,
  temperature: number = 0.7
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;

  // For MVP demo: If no API key is provided, return mock responses
  if (!apiKey || apiKey === 'mock' || apiKey === '') {
    console.log('[OpenAI Mock] System:', systemPrompt.substring(0, 100));
    console.log('[OpenAI Mock] User:', userPrompt.substring(0, 100));
    return getMockResponse(systemPrompt, userPrompt);
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error('OpenAI API error:', error);
    // Fallback to mock response on error
    return getMockResponse(systemPrompt, userPrompt);
  }
}

/**
 * Call OpenAI with a full conversation history
 * @param messages - Array of conversation messages
 * @param temperature - Controls randomness (0-1)
 * @returns The AI's response text
 */
export async function callOpenAIChat(
  messages: ChatMessage[],
  temperature: number = 0.7
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;

  // For MVP demo: If no API key is provided, return mock responses
  if (!apiKey || apiKey === 'mock' || apiKey === '') {
    const lastUserMessage = messages.filter((m) => m.role === 'user').pop()?.content || '';
    console.log('[OpenAI Mock Chat] Last message:', lastUserMessage.substring(0, 100));
    return getMockChatResponse(lastUserMessage);
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        temperature,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error('OpenAI API error:', error);
    const lastUserMessage = messages.filter((m) => m.role === 'user').pop()?.content || '';
    return getMockChatResponse(lastUserMessage);
  }
}

/**
 * Mock response generator for demo purposes
 * Provides realistic responses based on the context
 */
function getMockResponse(systemPrompt: string, userPrompt: string): string {
  // Impulse classification mock
  if (systemPrompt.includes('classify') || systemPrompt.includes('kategorisieren')) {
    return JSON.stringify({
      category: 'Shopping',
      isImpulse: true,
      decisionLabel: 'unnecessary',
      decisionExplanation:
        'Spontaner Online-Kauf ohne vorherige Planung. Möglicherweise emotional motiviert.',
    });
  }

  // Savings goal parsing mock
  if (systemPrompt.includes('Sparziel') || systemPrompt.includes('savings goal')) {
    return JSON.stringify({
      goalTitle: 'Thailand Ferien',
      targetAmount: 2500,
      targetDate: '2026-03-31',
      rules: [
        'Shopping maximal 300 CHF pro Monat',
        'Food Delivery maximal 2x pro Woche',
        'Vor jedem Kauf über 100 CHF: 24h Bedenkzeit',
        'Jeden Monat 200 CHF aufs Sparkonto überweisen',
      ],
    });
  }

  return 'Mock response: ' + userPrompt.substring(0, 50);
}

/**
 * Mock chat response for finance coach
 */
function getMockChatResponse(userMessage: string): string {
  const lowerMessage = userMessage.toLowerCase();

  if (lowerMessage.includes('sparen') || lowerMessage.includes('ziel')) {
    return 'Das ist ein tolles Sparziel! Ich habe dir konkrete Verhaltensregeln erstellt, die dir helfen, dein Ziel zu erreichen. Bleib fokussiert und tracke regelmässig deinen Fortschritt!';
  }

  if (lowerMessage.includes('ausgaben') || lowerMessage.includes('kosten')) {
    return 'Schauen wir uns deine Ausgaben genauer an. Ich sehe, dass du besonders viel für Shopping ausgibst. Vielleicht könnten wir hier Einsparpotenzial finden?';
  }

  if (lowerMessage.includes('impulskauf') || lowerMessage.includes('impulse')) {
    return 'Impulskäufe sind normal, aber sie können deine Sparziele gefährden. Ich empfehle die 24-Stunden-Regel: Warte einen Tag, bevor du einen Kauf über 50 CHF tätigst.';
  }

  return 'Ich verstehe. Lass uns gemeinsam an deinen Finanzen arbeiten. Was möchtest du als nächstes erreichen?';
}
