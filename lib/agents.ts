/**
 * SmartBudgetAI Agent Architecture
 *
 * This module implements the four core agents that power the AI analysis:
 * 1. DataExtractionAgent - Parses raw input into structured transactions
 * 2. ImpulseClassificationAgent - Classifies transactions with AI
 * 3. SavingsGoalAgent - Extracts savings goals from natural language
 * 4. BudgetPlannerAgent - Generates budget summaries and behavioral insights
 *
 * Each agent has clear input/output types and can be easily replaced or extended.
 * In a future Strapi backend, these could become Strapi plugins or services.
 */

import { randomUUID } from 'crypto';
import { callOpenAI } from './openai';
import { getKaggleFewShots } from './kaggleData';
import type {
  DataExtractionInput,
  Transaction,
  ImpulseClassificationInput,
  ImpulseClassificationOutput,
  SavingsGoalInput,
  SavingsGoalOutput,
  BudgetPlannerInput,
  BudgetPlannerOutput,
  CategorySpending,
} from './types';

/**
 * AGENT 1: DataExtractionAgent
 * Converts raw form input into a structured Transaction object
 * This is currently simple mapping but could be extended with NLP parsing
 */
export async function dataExtractionAgent(
  input: DataExtractionInput,
  userId: string
): Promise<Omit<Transaction, 'category' | 'isImpulse' | 'decisionLabel' | 'decisionExplanation'>> {
  const transaction = {
    id: randomUUID(),
    userId,
    date: input.date || new Date().toISOString().split('T')[0],
    merchant: input.merchant.trim(),
    amount: Number(input.amount),
    rawCategory: input.rawCategory?.trim(),
    justification: input.justification?.trim(),
  };

  return transaction;
}

/**
 * AGENT 2: ImpulseClassificationAgent
 * Uses AI with few-shot examples from Kaggle data to classify transactions
 * Determines: category, impulse status, usefulness, and explanation
 */
export async function impulseClassificationAgent(
  input: ImpulseClassificationInput
): Promise<ImpulseClassificationOutput> {
  const { transaction } = input;

  // Get few-shot examples from Kaggle dataset
  const fewShots = await getKaggleFewShots();

  // Build few-shot examples for the prompt
  const examplesText = fewShots
    .map(
      (shot) =>
        `Beispiel:
Händler: ${shot.merchant}
Betrag: ${shot.amount} CHF
Kategorie: ${shot.category}
Impulskauf: ${shot.isImpulse ? 'Ja' : 'Nein'}
Entscheidung: ${shot.decisionLabel === 'useful' ? 'Sinnvoll' : 'Unnötig'}
Erklärung: ${shot.decisionExplanation}`
    )
    .join('\n\n');

  const systemPrompt = `Du bist ein KI-Experte für persönliche Finanzen. Deine Aufgabe ist es, Transaktionen zu analysieren und zu kategorisieren.

Analysiere die Transaktion und gib eine JSON-Antwort mit folgenden Feldern zurück:
- category: Eine der folgenden Kategorien: "Shopping", "Food Delivery", "Transport", "Unterhaltung", "Lebensmittel", "Gesundheit", "Bildung", "Wohnen", "Versicherung", "Sonstiges"
- isImpulse: true wenn es ein Impulskauf war (spontan, emotional, ungeplant), sonst false
- decisionLabel: "useful" wenn der Kauf sinnvoll/notwendig war, "unnecessary" wenn unnötig
- decisionExplanation: Eine kurze Erklärung auf Deutsch (1-2 Sätze), die dem Nutzer hilft, sein Kaufverhalten zu reflektieren

Hier sind einige Beispiele zur Orientierung:

${examplesText}

Antworte NUR mit einem gültigen JSON-Objekt, ohne zusätzlichen Text.`;

  const userPrompt = `Analysiere diese Transaktion:
Händler: ${transaction.merchant}
Betrag: ${transaction.amount} CHF
${transaction.rawCategory ? `Kategorie (vom Nutzer): ${transaction.rawCategory}` : ''}
${transaction.justification ? `Begründung: ${transaction.justification}` : ''}`;

  try {
    const response = await callOpenAI(systemPrompt, userPrompt, 0.3);

    // Parse JSON response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        category: parsed.category || 'Sonstiges',
        isImpulse: Boolean(parsed.isImpulse),
        decisionLabel: parsed.decisionLabel === 'unnecessary' ? 'unnecessary' : 'useful',
        decisionExplanation: parsed.decisionExplanation || 'Keine Erklärung verfügbar.',
      };
    }
  } catch (error) {
    console.error('Error in impulseClassificationAgent:', error);
  }

  // Fallback classification
  return fallbackClassification(transaction);
}

/**
 * Fallback classification when AI is not available
 */
function fallbackClassification(
  transaction: Omit<Transaction, 'category' | 'isImpulse' | 'decisionLabel' | 'decisionExplanation'>
): ImpulseClassificationOutput {
  const merchant = transaction.merchant.toLowerCase();

  let category = 'Sonstiges';
  let isImpulse = false;
  let decisionLabel: 'useful' | 'unnecessary' = 'useful';

  // Simple keyword-based classification
  if (merchant.includes('coop') || merchant.includes('migros') || merchant.includes('aldi') || merchant.includes('lidl')) {
    category = 'Lebensmittel';
    decisionLabel = 'useful';
  } else if (merchant.includes('uber') || merchant.includes('delivery') || merchant.includes('pizza') || merchant.includes('restaurant')) {
    category = 'Food Delivery';
    isImpulse = transaction.amount > 30;
    decisionLabel = transaction.amount > 40 ? 'unnecessary' : 'useful';
  } else if (merchant.includes('sbb') || merchant.includes('uber') || merchant.includes('taxi')) {
    category = 'Transport';
  } else if (merchant.includes('zalando') || merchant.includes('h&m') || merchant.includes('zara') || merchant.includes('shopping')) {
    category = 'Shopping';
    isImpulse = transaction.amount > 50;
    decisionLabel = isImpulse ? 'unnecessary' : 'useful';
  } else if (merchant.includes('netflix') || merchant.includes('spotify') || merchant.includes('kino') || merchant.includes('cinema')) {
    category = 'Unterhaltung';
  }

  const decisionExplanation = isImpulse
    ? `Spontaner Kauf bei ${transaction.merchant}. Überlege beim nächsten Mal, ob du das wirklich brauchst.`
    : `Regulärer Kauf bei ${transaction.merchant}. Scheint geplant und sinnvoll zu sein.`;

  return { category, isImpulse, decisionLabel, decisionExplanation };
}

/**
 * AGENT 3: SavingsGoalAgent
 * Parses natural language to extract savings goal details
 * Generates concrete behavioral rules to help achieve the goal
 */
export async function savingsGoalAgent(input: SavingsGoalInput): Promise<SavingsGoalOutput> {
  const systemPrompt = `Du bist ein KI-Finanzcoach, der Nutzern hilft, ihre Sparziele zu definieren.

Analysiere die Nachricht des Nutzers und extrahiere:
1. goalTitle: Ein kurzer, prägnanter Titel für das Sparziel (z.B. "Thailand Ferien", "Neues Auto")
2. targetAmount: Den Zielbetrag in CHF (als Zahl)
3. targetDate: Das Zieldatum im Format YYYY-MM-DD
4. rules: 3-4 konkrete Verhaltensregeln, die dem Nutzer helfen, das Ziel zu erreichen

Die Regeln sollen spezifisch, messbar und realistisch sein. Beispiele:
- "Shopping maximal 300 CHF pro Monat"
- "Food Delivery maximal 2x pro Woche"
- "Vor jedem Kauf über 100 CHF: 24h Bedenkzeit"
- "Jeden Monat 200 CHF aufs Sparkonto überweisen"

Antworte NUR mit einem gültigen JSON-Objekt mit den Feldern: goalTitle, targetAmount, targetDate, rules (Array von Strings).`;

  const userPrompt = input.userMessage;

  try {
    const response = await callOpenAI(systemPrompt, userPrompt, 0.5);

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        goalTitle: parsed.goalTitle || 'Neues Sparziel',
        targetAmount: Number(parsed.targetAmount) || 1000,
        targetDate: parsed.targetDate || new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        rules: Array.isArray(parsed.rules) ? parsed.rules : [
          'Monatliches Budget einhalten',
          'Impulskäufe vermeiden',
          'Regelmässig Sparen',
        ],
      };
    }
  } catch (error) {
    console.error('Error in savingsGoalAgent:', error);
  }

  // Fallback goal extraction
  return {
    goalTitle: 'Neues Sparziel',
    targetAmount: 1000,
    targetDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    rules: [
      'Monatliches Budget einhalten',
      'Impulskäufe vermeiden',
      'Regelmässig 100 CHF sparen',
    ],
  };
}

/**
 * AGENT 4: BudgetPlannerAgent
 * Analyzes transactions and generates budget insights
 * Detects patterns and provides nudges in German
 */
export async function budgetPlannerAgent(input: BudgetPlannerInput): Promise<BudgetPlannerOutput> {
  const { monthlyNetIncome, transactions, month } = input;

  // Calculate monthly budget (60% of net income available for flexible spending)
  const monthlyBudget = monthlyNetIncome * 0.6;

  // Filter transactions for the specified month
  const monthTransactions = transactions.filter((t) => t.date.startsWith(month));

  // Calculate total spent
  const usedBudget = monthTransactions.reduce((sum, t) => sum + t.amount, 0);

  // Group by category
  const categoryMap = new Map<string, number>();
  monthTransactions.forEach((t) => {
    const current = categoryMap.get(t.category) || 0;
    categoryMap.set(t.category, current + t.amount);
  });

  const byCategory: CategorySpending[] = Array.from(categoryMap.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);

  // Detect patterns and generate nudges
  const patterns = detectPatterns(monthTransactions);

  return {
    monthlyBudget,
    usedBudget,
    byCategory,
    patterns,
  };
}

/**
 * Detect spending patterns and generate behavioral nudges
 */
function detectPatterns(transactions: Transaction[]): string[] {
  const patterns: string[] = [];

  if (transactions.length === 0) {
    return ['Noch keine Transaktionen für diesen Monat.'];
  }

  // Pattern 1: Most expensive day of week
  const daySpending = new Map<string, number>();
  const dayNames = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

  transactions.forEach((t) => {
    const date = new Date(t.date);
    const day = dayNames[date.getDay()];
    daySpending.set(day, (daySpending.get(day) || 0) + t.amount);
  });

  if (daySpending.size > 0) {
    const [mostExpensiveDay, amount] = Array.from(daySpending.entries())
      .sort((a, b) => b[1] - a[1])[0];
    patterns.push(`${mostExpensiveDay} ist dein teuerster Tag (Durchschnitt ${Math.round(amount)} CHF).`);
  }

  // Pattern 2: Impulse purchases timing
  const impulseTransactions = transactions.filter((t) => t.isImpulse);
  const lateNightImpulses = impulseTransactions.filter((t) => {
    const date = new Date(t.date);
    const hour = date.getHours();
    return hour >= 22 || hour <= 2;
  });

  if (impulseTransactions.length > 0) {
    const impulseRate = Math.round((impulseTransactions.length / transactions.length) * 100);
    patterns.push(`${impulseRate}% deiner Käufe sind Impulskäufe. Versuche, vor dem Kauf eine Pause einzulegen.`);
  }

  if (lateNightImpulses.length >= 2) {
    patterns.push('Zwischen 22:00 und 02:00 machst du viele Impulskäufe. Vielleicht hilft eine "Kaufsperre" nach 22 Uhr?');
  }

  // Pattern 3: Top spending category
  const categoryMap = new Map<string, number>();
  transactions.forEach((t) => {
    categoryMap.set(t.category, (categoryMap.get(t.category) || 0) + t.amount);
  });

  if (categoryMap.size > 0) {
    const [topCategory, topAmount] = Array.from(categoryMap.entries())
      .sort((a, b) => b[1] - a[1])[0];
    const percentage = Math.round((topAmount / transactions.reduce((sum, t) => sum + t.amount, 0)) * 100);
    patterns.push(`${topCategory} macht ${percentage}% deiner Ausgaben aus (${Math.round(topAmount)} CHF).`);
  }

  return patterns.slice(0, 3); // Return top 3 patterns
}
