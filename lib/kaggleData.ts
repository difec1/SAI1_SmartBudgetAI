/**
 * Kaggle Dataset Integration Module
 *
 * This module loads and provides access to historical transaction data from Kaggle.
 * The dataset is used for:
 * 1. Few-shot examples for the ImpulseClassificationAgent
 * 2. Baseline statistics for the BudgetPlannerAgent
 *
 * In production, this would load from a CSV file in /data folder.
 * For the MVP, we provide synthetic sample data that mimics a real Kaggle dataset.
 */

import type { KaggleTransaction } from './types';

/**
 * In-memory cache of Kaggle dataset
 * In production, this would be loaded from CSV on server startup
 */
let kaggleDataCache: KaggleTransaction[] | null = null;

/**
 * Load Kaggle dataset
 * For MVP: Returns synthetic data
 * TODO: In production, read from /data/transactions.csv
 */
export async function loadKaggleData(): Promise<KaggleTransaction[]> {
  if (kaggleDataCache) {
    return kaggleDataCache;
  }

  // For MVP: Synthetic dataset mimicking real transaction data
  // In production, this would parse a CSV file
  kaggleDataCache = [
    // Lebensmittel (Groceries) - mostly useful
    {
      date: '2024-01-15',
      merchant: 'Coop',
      amount: 87.5,
      category: 'Lebensmittel',
      isImpulse: false,
      decisionLabel: 'useful',
      decisionExplanation: 'Regelmässiger Lebensmitteleinkauf für die Woche. Sinnvolle Haushaltsausgabe.',
    },
    {
      date: '2024-01-18',
      merchant: 'Migros',
      amount: 45.2,
      category: 'Lebensmittel',
      isImpulse: false,
      decisionLabel: 'useful',
      decisionExplanation: 'Notwendiger Einkauf von Grundnahrungsmitteln.',
    },
    // Shopping - often impulse
    {
      date: '2024-01-20',
      merchant: 'Zalando',
      amount: 129.9,
      category: 'Shopping',
      isImpulse: true,
      decisionLabel: 'unnecessary',
      decisionExplanation: 'Online-Shopping ohne konkreten Bedarf. Klassischer Impulskauf spätabends.',
    },
    {
      date: '2024-02-03',
      merchant: 'H&M',
      amount: 89.5,
      category: 'Shopping',
      isImpulse: true,
      decisionLabel: 'unnecessary',
      decisionExplanation: 'Spontaner Kleiderkauf im Laden. Nicht geplant, emotional motiviert.',
    },
    {
      date: '2024-02-10',
      merchant: 'Manor',
      amount: 156.0,
      category: 'Shopping',
      isImpulse: false,
      decisionLabel: 'useful',
      decisionExplanation: 'Geplanter Kauf von notwendigen Kleidungsstücken.',
    },
    // Food Delivery - mixed
    {
      date: '2024-01-22',
      merchant: 'Uber Eats',
      amount: 42.5,
      category: 'Food Delivery',
      isImpulse: true,
      decisionLabel: 'unnecessary',
      decisionExplanation: 'Späte Essensbestellung aus Bequemlichkeit, obwohl Lebensmittel zu Hause waren.',
    },
    {
      date: '2024-02-05',
      merchant: 'Just Eat',
      amount: 38.9,
      category: 'Food Delivery',
      isImpulse: true,
      decisionLabel: 'unnecessary',
      decisionExplanation: 'Spontane Bestellung ohne echten Bedarf. Hätte selbst kochen können.',
    },
    {
      date: '2024-02-14',
      merchant: 'Pizza Kurier',
      amount: 65.0,
      category: 'Food Delivery',
      isImpulse: false,
      decisionLabel: 'useful',
      decisionExplanation: 'Geplantes Abendessen mit Freunden. Soziales Event.',
    },
    // Transport - usually useful
    {
      date: '2024-01-16',
      merchant: 'SBB',
      amount: 85.0,
      category: 'Transport',
      isImpulse: false,
      decisionLabel: 'useful',
      decisionExplanation: 'Monatliches Bahnabo für den Arbeitsweg. Notwendige Ausgabe.',
    },
    {
      date: '2024-01-25',
      merchant: 'Uber',
      amount: 28.5,
      category: 'Transport',
      isImpulse: false,
      decisionLabel: 'useful',
      decisionExplanation: 'Taxifahrt nach verpasstem letztem Zug. Notwendig.',
    },
    {
      date: '2024-02-08',
      merchant: 'Mobility',
      amount: 45.0,
      category: 'Transport',
      isImpulse: false,
      decisionLabel: 'useful',
      decisionExplanation: 'Carsharing für Wochenendeinkauf. Sinnvolle Nutzung.',
    },
    // Unterhaltung (Entertainment) - mixed
    {
      date: '2024-01-30',
      merchant: 'Netflix',
      amount: 19.9,
      category: 'Unterhaltung',
      isImpulse: false,
      decisionLabel: 'useful',
      decisionExplanation: 'Monatliches Streaming-Abo. Geplante Unterhaltungsausgabe.',
    },
    {
      date: '2024-02-12',
      merchant: 'Spotify',
      amount: 12.9,
      category: 'Unterhaltung',
      isImpulse: false,
      decisionLabel: 'useful',
      decisionExplanation: 'Musik-Streaming Abo. Regelmässige Fixkosten.',
    },
    {
      date: '2024-02-16',
      merchant: 'Kino Arena',
      amount: 85.0,
      category: 'Unterhaltung',
      isImpulse: true,
      decisionLabel: 'unnecessary',
      decisionExplanation: 'Spontaner Kinobesuch mit Snacks. War nicht eingeplant.',
    },
    // Gesundheit (Health) - usually useful
    {
      date: '2024-01-19',
      merchant: 'Apotheke',
      amount: 34.5,
      category: 'Gesundheit',
      isImpulse: false,
      decisionLabel: 'useful',
      decisionExplanation: 'Notwendige Medikamente und Gesundheitsprodukte.',
    },
    {
      date: '2024-02-07',
      merchant: 'Fitnesscenter',
      amount: 79.0,
      category: 'Gesundheit',
      isImpulse: false,
      decisionLabel: 'useful',
      decisionExplanation: 'Monatsbeitrag Fitnessstudio. Investition in Gesundheit.',
    },
  ];

  return kaggleDataCache;
}

/**
 * Get few-shot examples for impulse classification
 * Returns a balanced sample of different categories and decision types
 */
export async function getKaggleFewShots(count: number = 5): Promise<KaggleTransaction[]> {
  const data = await loadKaggleData();

  // Select diverse examples: mix of categories and decisions
  const examples: KaggleTransaction[] = [];

  // Add one from each major category
  const categories = ['Lebensmittel', 'Shopping', 'Food Delivery', 'Transport', 'Unterhaltung'];

  for (const category of categories) {
    const categoryExample = data.find((t) => t.category === category);
    if (categoryExample && examples.length < count) {
      examples.push(categoryExample);
    }
  }

  // Fill remaining with diverse examples
  while (examples.length < count && examples.length < data.length) {
    const randomIndex = Math.floor(Math.random() * data.length);
    const candidate = data[randomIndex];
    if (!examples.includes(candidate)) {
      examples.push(candidate);
    }
  }

  return examples.slice(0, count);
}

/**
 * Get baseline statistics from Kaggle dataset
 * Used by BudgetPlannerAgent for comparison
 */
export async function getKaggleStatistics(): Promise<{
  averageSpendingByCategory: Map<string, number>;
  impulseRate: number;
  totalTransactions: number;
}> {
  const data = await loadKaggleData();

  const categorySpending = new Map<string, { total: number; count: number }>();

  data.forEach((t) => {
    const current = categorySpending.get(t.category) || { total: 0, count: 0 };
    categorySpending.set(t.category, {
      total: current.total + t.amount,
      count: current.count + 1,
    });
  });

  const averageSpendingByCategory = new Map<string, number>();
  categorySpending.forEach((value, key) => {
    averageSpendingByCategory.set(key, value.total / value.count);
  });

  const impulseCount = data.filter((t) => t.isImpulse).length;
  const impulseRate = impulseCount / data.length;

  return {
    averageSpendingByCategory,
    impulseRate,
    totalTransactions: data.length,
  };
}

/**
 * TODO: Production CSV loader
 * Uncomment and implement when deploying with real Kaggle data
 */
/*
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

export async function loadKaggleDataFromCSV(): Promise<KaggleTransaction[]> {
  const csvPath = path.join(process.cwd(), 'data', 'transactions.csv');

  try {
    const fileContent = fs.readFileSync(csvPath, 'utf-8');
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
    });

    return records.map((record: any) => ({
      date: record.date,
      merchant: record.merchant,
      amount: parseFloat(record.amount),
      category: record.category,
      isImpulse: record.isImpulse === 'true' || record.isImpulse === '1',
      decisionLabel: record.decisionLabel as 'useful' | 'unnecessary',
      decisionExplanation: record.decisionExplanation,
    }));
  } catch (error) {
    console.error('Error loading Kaggle CSV:', error);
    return [];
  }
}
*/
