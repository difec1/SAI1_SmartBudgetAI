/**
 * Core data models for SmartBudgetAI
 * These types define the structure of our data entities.
 * In the future Strapi backend, these would map to Strapi Content Types.
 */

export interface User {
  id: string;
  name: string;
  monthlyNetIncome: number;
}

export interface Transaction {
  id: string;
  userId: string;
  date: string; // ISO date string
  merchant: string;
  amount: number; // in CHF
  rawCategory?: string; // optional user-provided category
  category: string; // AI-classified category
  justification?: string; // optional user explanation
  isImpulse: boolean;
  decisionLabel: 'useful' | 'unnecessary';
  decisionExplanation: string; // AI-generated explanation in German
}

export interface SavingsGoal {
  id: string;
  userId: string;
  title: string;
  targetAmount: number; // in CHF
  targetDate: string; // ISO date string
  currentSavedAmount: number;
  rules: string[]; // Concrete behavior rules in German
}

export interface BudgetSummary {
  userId: string;
  month: string; // YYYY-MM format
  monthlyBudget: number; // Available budget for flexible spending
  usedBudget: number; // Amount already spent
  byCategory: CategorySpending[];
}

export interface CategorySpending {
  category: string;
  amount: number;
}

// Agent input/output types

export interface DataExtractionInput {
  date?: string;
  merchant: string;
  amount: number;
  rawCategory?: string;
  justification?: string;
}

export interface ImpulseClassificationInput {
  transaction: Omit<Transaction, 'category' | 'isImpulse' | 'decisionLabel' | 'decisionExplanation'>;
}

export interface ImpulseClassificationOutput {
  category: string;
  isImpulse: boolean;
  decisionLabel: 'useful' | 'unnecessary';
  decisionExplanation: string;
}

export interface SavingsGoalInput {
  userMessage: string;
  userId: string;
}

export interface SavingsGoalOutput {
  goalTitle: string;
  targetAmount: number;
  targetDate: string;
  rules: string[];
}

export interface BudgetPlannerInput {
  userId: string;
  monthlyNetIncome: number;
  transactions: Transaction[];
  month: string;
}

export interface BudgetPlannerOutput {
  monthlyBudget: number;
  usedBudget: number;
  byCategory: CategorySpending[];
  patterns: string[]; // Detected patterns and nudges in German
}

// Chat types

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatRequest {
  conversation: ChatMessage[];
  userId: string;
}

export interface ChatResponse {
  assistantMessage: string;
  updatedGoals?: SavingsGoal[];
}

// Kaggle dataset types

export interface KaggleTransaction {
  date: string;
  merchant: string;
  amount: number;
  category: string;
  isImpulse: boolean;
  decisionLabel: 'useful' | 'unnecessary';
  decisionExplanation: string;
}
