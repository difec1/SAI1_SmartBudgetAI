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
- category: Nutze bevorzugt eine der folgenden Kategorien: "Lohn", "Weitere Einnahmen", "Zahlungen", "Mobilität - Öffentlicher Verkehr", "Mobilität - Auto", "Shopping", "Lebensmittel", "Gastronomie", "Unterhaltung", "Persönliches", "Reisen", "Bargeldbezug", "Gesundheit", "Sparen & Anlegen", "Wohnen", "Steuern", "Allgemeines", "Abos", "Bildung". Falls keine passt, erfinde eine kurze, prägnante Kategorie. Wichtig: Alle Lohneingänge (auch Nebenjob, Werkstudent, 450€-Job, Teilzeit) bitte als "Lohn" kategorisieren, nur unregelmäßige sonstige Einnahmen als "Weitere Einnahmen".
- isImpulse: true wenn es ein Impulskauf war (spontan, emotional, ungeplant), sonst false
- decisionLabel: "useful" wenn der Kauf sinnvoll/notwendig war, "unnecessary" wenn unnötig
- decisionExplanation: Eine kurze Erklärung auf Deutsch (1-2 Sätze), die dem Nutzer hilft, sein Kaufverhalten zu reflektieren
- Sei vorsichtig mit "unnecessary": Markiere Ausgaben nur dann als eher unnötig, wenn sie klar nicht ins Budget passen (z.B. sehr hoher Betrag) oder wenn sich gleichartige Ausgaben in kurzer Zeit häufen (z.B. mehrere Restaurantbesuche im gleichen Monat). Ohne Verlaufskontext entscheide milde und gib eher "useful" mit Hinweis auf bewussten Konsum.
- Wenn ein Kauf Sparziele konterkariert (z.B. hoher Betrag in Shopping, während gespart werden soll), erwähne das als Denkanstoß.

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
        category: parsed.category || 'Allgemeines',
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

  let category = 'Allgemeines';
  let isImpulse = false;
  let decisionLabel: 'useful' | 'unnecessary' = 'useful';

  // Simple keyword-based classification aligned to the new taxonomy
  if (merchant.includes('lohn') || merchant.includes('gehalt') || merchant.includes('salary') || merchant.includes('payroll')) {
    category = 'Lohn';
    decisionLabel = 'useful';
  } else if (merchant.includes('bonus') || merchant.includes('nebenjob') || merchant.includes('zahlungseingang')) {
    category = 'Weitere Einnahmen';
    decisionLabel = 'useful';
  } else if (merchant.includes('sbb') || merchant.includes('bvg') || merchant.includes('db') || merchant.includes('tram') || merchant.includes('bus')) {
    category = 'Mobilität - Öffentlicher Verkehr';
  } else if (merchant.includes('shell') || merchant.includes('avia') || merchant.includes('tank') || merchant.includes('parking') || merchant.includes('auto')) {
    category = 'Mobilität - Auto';
  } else if (merchant.includes('coop') || merchant.includes('migros') || merchant.includes('aldi') || merchant.includes('lidl')) {
    category = 'Lebensmittel';
    decisionLabel = 'useful';
  } else if (merchant.includes('uber eats') || merchant.includes('just eat') || merchant.includes('pizza') || merchant.includes('restaurant') || merchant.includes('bar') || merchant.includes('cafe')) {
    category = 'Gastronomie';
    isImpulse = transaction.amount > 50;
    decisionLabel = transaction.amount > 80 ? 'unnecessary' : 'useful'; // milder bewerten, erst bei hohen Beträgen kritisch
  } else if (merchant.includes('zalando') || merchant.includes('h&m') || merchant.includes('zara') || merchant.includes('shopping')) {
    category = 'Shopping';
    isImpulse = transaction.amount > 80;
    decisionLabel = isImpulse ? 'unnecessary' : 'useful';
  } else if (merchant.includes('netflix') || merchant.includes('spotify') || merchant.includes('kino') || merchant.includes('cinema')) {
    category = 'Unterhaltung';
  } else if (merchant.includes('krankenkasse') || merchant.includes('arzt') || merchant.includes('apotheke') || merchant.includes('zahnarzt')) {
    category = 'Gesundheit';
    decisionLabel = 'useful';
  } else if (merchant.includes('miete') || merchant.includes('stie') || merchant.includes('vermieter') || merchant.includes('wohnung')) {
    category = 'Wohnen';
    decisionLabel = 'useful';
  } else if (merchant.includes('steuer') || merchant.includes('tax')) {
    category = 'Steuern';
    decisionLabel = 'useful';
  } else if (merchant.includes('sparplan') || merchant.includes('etf') || merchant.includes('anlage') || merchant.includes('vorsorge')) {
    category = 'Sparen & Anlegen';
    decisionLabel = 'useful';
  } else if (merchant.includes('abo') || merchant.includes('subscription')) {
    category = 'Abos';
  } else if (merchant.includes('reise') || merchant.includes('air') || merchant.includes('hotel')) {
    category = 'Reisen';
  } else if (merchant.includes('bargeld') || merchant.includes('atm')) {
    category = 'Bargeldbezug';
  } else if (merchant.includes('zahlung') || merchant.includes('invoice') || merchant.includes('rechnung')) {
    category = 'Zahlungen';
  } else if (merchant.includes('persönlich') || merchant.includes('persoenlich') || merchant.includes('friseur') || merchant.includes('kosmetik')) {
    category = 'Persönliches';
  } else if (merchant.includes('bildung') || merchant.includes('studien') || merchant.includes('studium') || merchant.includes('schule') || merchant.includes('uni') || merchant.includes('kurs') || merchant.includes('bfh')) {
    category = 'Bildung';
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
      const suggestedDate =
        parsed.targetDate && isFutureDate(parsed.targetDate)
          ? parsed.targetDate
          : getFutureDateISO(180);
      return {
        goalTitle: parsed.goalTitle || 'Neues Sparziel',
        targetAmount: Number(parsed.targetAmount) || 1000,
        targetDate: suggestedDate,
        rules: Array.isArray(parsed.rules) ? parsed.rules : [
          'Monatliches Budget einhalten',
          'Impulskäufe vermeiden',
          'Regelmäßig sparen',
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
    targetDate: getFutureDateISO(180),
    rules: [
      'Monatliches Budget einhalten',
      'Impulskäufe vermeiden',
      'Regelmäßig 100 CHF sparen',
    ],
  };
}

/**
 * AGENT 4: BudgetPlannerAgent
 * Analyzes transactions and generates budget insights
 * Detects patterns and provides nudges in German
 */
export async function budgetPlannerAgent(input: BudgetPlannerInput): Promise<BudgetPlannerOutput> {
  const {
    monthlyNetIncome,
    transactions,
    month,
    timeframe = 'month',
    budgetMode = 'auto',
    startDate,
    endDate,
  } = input;

  // Relevante Transaktionen nach Zeitraum filtern (Monat oder ganzes Jahr)
  const scopedTransactions = filterTransactionsByScope(transactions, month, timeframe, startDate, endDate);
  const expenseTransactions = scopedTransactions.filter((t) => !isIncomeTransaction(t));
  const salaryTransactions = scopedTransactions.filter(isSalaryTransaction);

  // Lohnhistorie auswerten und Durchschnitt berechnen (max. letzte 12 Monate, nur Lohn)
  const referenceMonth = endDate ? endDate.slice(0, 7) : month;
  const inferredSalary = inferMonthlySalaryFromHistory(transactions, referenceMonth);
  const salarySumInScope = salaryTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);

  // Manuelle Vorgabe bevorzugen, falls der Nutzer das Budget angepasst hat
  const manualBudget = budgetMode === 'manual' && monthlyNetIncome > 0 ? monthlyNetIncome * 0.6 : undefined;

  // Budget: bevorzugt tatsächliche Lohnsumme im Zeitraum; Fallback manuell oder 60%-Schätzwert
  const monthsInScope = calculateMonthsInScope(timeframe, month, startDate, endDate);
  const manualScopedBudget = manualBudget !== undefined ? manualBudget * monthsInScope : undefined;

  const scopedBudget =
    budgetMode === 'manual'
      ? manualScopedBudget ?? 0
      : salarySumInScope > 0
      ? salarySumInScope
      : inferredSalary > 0
      ? inferredSalary * 0.6 * monthsInScope
      : monthlyNetIncome * 0.6 * monthsInScope;

  // Calculate total spent (nur Ausgaben)
  const usedBudget = expenseTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);

  // Group by category (nur Ausgaben)
  const categoryMap = new Map<string, number>();
  expenseTransactions.forEach((t) => {
    const current = categoryMap.get(t.category) || 0;
    categoryMap.set(t.category, current + t.amount);
  });

  const byCategory: CategorySpending[] = Array.from(categoryMap.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);

  // Detect patterns and generate nudges (nur Ausgaben, zeitraumabhängig)
  const patterns = detectPatterns(expenseTransactions, timeframe);

  return {
    monthlyBudget: scopedBudget,
    usedBudget,
    byCategory,
    patterns,
    timeframe,
  };
}

/**
 * Detect spending patterns and generate behavioral nudges
 */
function detectPatterns(transactions: Transaction[], timeframe: 'month' | 'year' | 'custom'): string[] {
  const patterns: string[] = [];

  if (transactions.length === 0) {
    return ['Noch keine Ausgaben für diesen Zeitraum.'];
  }

  // Pattern 1: Most expensive day of week (average per day)
  const daySpending = new Map<string, { total: number; count: number }>();
  const dayNames = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

  transactions.forEach((t) => {
    const date = new Date(t.date);
    const day = dayNames[date.getDay()];
    const current = daySpending.get(day) || { total: 0, count: 0 };
    daySpending.set(day, { total: current.total + t.amount, count: current.count + 1 });
  });

  if (daySpending.size > 0) {
    const [mostExpensiveDay, stats] = Array.from(daySpending.entries()).sort((a, b) => b[1].total - a[1].total)[0];
    const average = stats.total / stats.count;
    patterns.push(`${mostExpensiveDay} ist dein teuerster Tag (Durchschnitt ${average.toFixed(2)} CHF).`);
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
    const [topCategory, topAmount] = Array.from(categoryMap.entries()).sort((a, b) => b[1] - a[1])[0];
    const percentage = Math.round((topAmount / transactions.reduce((sum, t) => sum + t.amount, 0)) * 100);
    patterns.push(`${topCategory} macht ${percentage}% deiner Ausgaben aus (${Math.round(topAmount)} CHF).`);
  }

  return patterns.slice(0, 3); // Return top 3 patterns
}

/**
 * Hilfsfunktion: erkennt Einnahmen anhand Kategorie und Textfeldern
 */
function isIncomeTransaction(t: Transaction): boolean {
  const incomeKeywords = ['lohn', 'salaer', 'salär', 'gehalt', 'salary', 'payroll', 'einkommen', 'bonus', 'wage', 'nebenjob', 'werkstudent'];
  const text = [t.merchant, t.rawCategory || '', t.justification || '']
    .join(' ')
    .toLowerCase();
  return incomeKeywords.some((kw) => text.includes(kw)) || t.category === 'Einnahmen' || t.category === 'Lohn' || t.category === 'Weitere Einnahmen';
}

/**
 * Hilfsfunktion: erkennt explizit Lohn (ohne weitere Einnahmen)
 */
function isSalaryTransaction(t: Transaction): boolean {
  const salaryKeywords = ['lohn', 'salaer', 'salär', 'gehalt', 'salary', 'payroll', 'wage', 'nebenjob', 'werkstudent'];
  const text = [t.merchant, t.rawCategory || '', t.justification || '', t.category]
    .join(' ')
    .toLowerCase();
  return salaryKeywords.some((kw) => text.includes(kw)) || t.category === 'Lohn';
}

/**
 * Filtert Transaktionen basierend auf Monat oder gesamtem Jahr
 */
function filterTransactionsByScope(
  transactions: Transaction[],
  month: string,
  timeframe: 'month' | 'year' | 'custom',
  startDate?: string,
  endDate?: string
): Transaction[] {
  if (timeframe === 'year') {
    const yearPrefix = month.slice(0, 4);
    return transactions.filter((t) => t.date.startsWith(yearPrefix));
  }
  if (timeframe === 'custom' && startDate && endDate) {
    return transactions.filter((t) => t.date >= startDate && t.date <= endDate);
  }
  return transactions.filter((t) => t.date.startsWith(month));
}

/**
 * Ermittelt die Anzahl Monate im Betrachtungszeitraum (mindestens 1)
 */
function calculateMonthsInScope(
  timeframe: 'month' | 'year' | 'custom',
  month: string,
  startDate?: string,
  endDate?: string
): number {
  if (timeframe === 'year') {
    return Math.max(1, Number(month.split('-')[1]));
  }
  if (timeframe === 'custom' && startDate && endDate) {
    const [sy, sm] = startDate.split('-').map(Number);
    const [ey, em] = endDate.split('-').map(Number);
    const diff = (ey - sy) * 12 + (em - sm) + 1;
    return Math.max(1, diff);
  }
  return 1;
}

/**
 * Leitet das durchschnittliche monatliche Nettoeinkommen aus vergangenen Lohnzahlungen ab
 */
function inferMonthlySalaryFromHistory(transactions: Transaction[], referenceMonth: string): number {
  const salaryTransactions = transactions.filter(isSalaryTransaction);
  if (salaryTransactions.length === 0) return 0;

  const incomeByMonth = new Map<string, number>();
  salaryTransactions.forEach((t) => {
    const monthKey = t.date.slice(0, 7);
    const previous = incomeByMonth.get(monthKey) || 0;
    incomeByMonth.set(monthKey, previous + Math.abs(t.amount));
  });

  const monthlyValues: number[] = [];
  incomeByMonth.forEach((value, monthKey) => {
    if (isWithinLastTwelveMonths(monthKey, referenceMonth)) {
      monthlyValues.push(value);
    }
  });

  if (monthlyValues.length === 0) return 0;
  const average = monthlyValues.reduce((sum, value) => sum + value, 0) / monthlyValues.length;
  return average;
}

function isWithinLastTwelveMonths(monthKey: string, referenceMonth: string): boolean {
  const [year, month] = monthKey.split('-').map(Number);
  const [refYear, refMonth] = referenceMonth.split('-').map(Number);
  const diff = (refYear - year) * 12 + (refMonth - month);
  return diff >= 0 && diff < 12;
}

function isFutureDate(dateStr: string): boolean {
  const inputDate = new Date(dateStr);
  const today = new Date();
  return inputDate.getTime() > today.getTime();
}

function getFutureDateISO(daysAhead: number): string {
  return new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
}
