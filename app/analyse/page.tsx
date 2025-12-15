'use client';

/**
 * Analyse-Seite:
 * - Lädt Budget-Analyse (Budget, Kategorien, Muster, Impulskäufe) für wählbaren Zeitraum.
 * - Ermöglicht Umschalten zwischen Monat/Jahr/Custom + Budgetquelle (auto/manuell).
 * - Zeigt Sparziele, Impulskäufe und erkannte Muster.
 */

import { useState, useEffect } from 'react';
import { ShoppingBag, Truck, Utensils, Tv, Package, AlertCircle, Target, TrendingUp, Trash2, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { BudgetSummary, Transaction, SavingsGoal } from '@/lib/types';
import { useI18n } from '@/hooks/useI18n';

const CATEGORY_ICONS: Record<string, any> = {
  Shopping: ShoppingBag,
  'Food Delivery': Utensils,
  Transport: Truck,
  Unterhaltung: Tv,
  Lebensmittel: Package,
  Gesundheit: AlertCircle,
  Sonstiges: Package,
};

const CATEGORY_LABELS: Record<string, { de: string; en: string }> = {
  Abos: { de: 'Abos', en: 'Subscriptions' },
  Allgemeines: { de: 'Allgemeines', en: 'General' },
  Bargeldbezug: { de: 'Bargeldbezug', en: 'Cash withdrawal' },
  Gastronomie: { de: 'Gastronomie', en: 'Dining' },
  Shopping: { de: 'Shopping', en: 'Shopping' },
  'Food Delivery': { de: 'Food Delivery', en: 'Food delivery' },
  'Mobilität - Auto': { de: 'Mobilität - Auto', en: 'Transport - Car' },
  'Mobilität - Öffentlicher Verkehr': { de: 'Mobilität - Öffentlicher Verkehr', en: 'Transport - Public' },
  Reisen: { de: 'Reisen', en: 'Travel' },
  Sparen: { de: 'Sparen', en: 'Saving' },
  'Sparen & Anlegen': { de: 'Sparen & Anlegen', en: 'Saving & Investing' },
  Steuern: { de: 'Steuern', en: 'Taxes' },
  Transport: { de: 'Transport', en: 'Transport' },
  Zahlungen: { de: 'Zahlungen', en: 'Payments' },
  Wohnen: { de: 'Wohnen', en: 'Housing' },
  Unterhaltung: { de: 'Unterhaltung', en: 'Entertainment' },
  Lebensmittel: { de: 'Lebensmittel', en: 'Groceries' },
  Gesundheit: { de: 'Gesundheit', en: 'Health' },
  Sonstiges: { de: 'Sonstiges', en: 'Other' },
};

export default function AnalysePage() {
  const { t, lang } = useI18n();
  const [budgetSummary, setBudgetSummary] = useState<BudgetSummary | null>(null);
  const [impulseTransactions, setImpulseTransactions] = useState<Transaction[]>([]);
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [patterns, setPatterns] = useState<string[]>([]);
  const [patternTranslations, setPatternTranslations] = useState<Record<string, string>>({});
  const [ruleTranslations, setRuleTranslations] = useState<Record<string, string>>({});
  const [impulseTranslations, setImpulseTranslations] = useState<Record<string, string>>({});
  const [impulseNotes, setImpulseNotes] = useState<Record<string, string>>({});
  const [savingImpulseId, setSavingImpulseId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedGoal, setSelectedGoal] = useState<SavingsGoal | null>(null);
  const [depositAmount, setDepositAmount] = useState('');
  const [showDepositDialog, setShowDepositDialog] = useState(false);
  const [timeframe, setTimeframe] = useState<'month' | 'year' | 'custom'>('month');
  const [budgetMode, setBudgetMode] = useState<'auto' | 'manual'>('auto');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [appliedStartDate, setAppliedStartDate] = useState('');
  const [appliedEndDate, setAppliedEndDate] = useState('');

  useEffect(() => {
    // Lokale Präferenzen (Zeitraum/Budgetquelle) beim Laden wiederherstellen
    // Standardansicht: immer aktueller Monat, keine Wiederherstellung des Zeitraums
    const savedStart = typeof window !== 'undefined' ? localStorage.getItem('analysisStartDate') : null;
    const savedEnd = typeof window !== 'undefined' ? localStorage.getItem('analysisEndDate') : null;
    if (savedStart) setStartDate(savedStart);
    if (savedEnd) setEndDate(savedEnd);
    if (savedStart) setAppliedStartDate(savedStart);
    if (savedEnd) setAppliedEndDate(savedEnd);
    const savedBudgetMode = typeof window !== 'undefined' ? localStorage.getItem('budgetMode') : null;
    if (savedBudgetMode === 'manual') {
      setBudgetMode('manual');
    }
  }, []);

  useEffect(() => {
    const canFetch =
      timeframe !== 'custom' ||
      (timeframe === 'custom' && appliedStartDate && appliedEndDate && appliedStartDate <= appliedEndDate);

    if (canFetch) {
      fetchAnalysis(timeframe, budgetMode, appliedStartDate, appliedEndDate);
    } else {
      setLoading(false);
    }
  }, [timeframe, budgetMode, appliedStartDate, appliedEndDate]);

  useEffect(() => {
    if (lang !== 'en' || patterns.length === 0) return;
    const uniquePatterns = Array.from(new Set(patterns));
    const missing = uniquePatterns.filter((p) => !patternTranslations[p]);
    if (missing.length === 0) return;

    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ texts: missing, targetLang: 'EN' }),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`Translate request failed: ${res.status}`);
        const data = await res.json();
        if (Array.isArray(data?.translations)) {
          setPatternTranslations((prev) => {
            const next = { ...prev };
            missing.forEach((p, idx) => {
              if (data.translations[idx]) next[p] = data.translations[idx];
            });
            return next;
          });
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error('Error translating patterns:', err);
      }
    })();

    return () => controller.abort();
  }, [lang, patterns, patternTranslations]);

  useEffect(() => {
    if (lang !== 'en' || goals.length === 0) return;
    const uniqueRules = Array.from(new Set(goals.flatMap((g) => g.rules || [])));
    const missing = uniqueRules.filter((r) => !ruleTranslations[r]);
    if (missing.length === 0) return;

    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ texts: missing, targetLang: 'EN' }),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`Translate request failed: ${res.status}`);
        const data = await res.json();
        if (Array.isArray(data?.translations)) {
          setRuleTranslations((prev) => {
            const next = { ...prev };
            missing.forEach((rule, idx) => {
              if (data.translations[idx]) next[rule] = data.translations[idx];
            });
            return next;
          });
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error('Error translating rules:', err);
      }
    })();

    return () => controller.abort();
  }, [lang, goals, ruleTranslations]);

  useEffect(() => {
    if (lang !== 'en' || impulseTransactions.length === 0) return;
    const unique = Array.from(
      new Set(impulseTransactions.map((t) => t.decisionExplanation).filter(Boolean))
    );
    const missing = unique.filter((text) => !impulseTranslations[text]);
    if (missing.length === 0) return;

    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ texts: missing, targetLang: 'EN' }),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`Translate request failed: ${res.status}`);
        const data = await res.json();
        if (Array.isArray(data?.translations)) {
          setImpulseTranslations((prev) => {
            const next = { ...prev };
            missing.forEach((text, idx) => {
              if (data.translations[idx]) next[text] = data.translations[idx];
            });
            return next;
          });
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error('Error translating impulse explanations:', err);
      }
    })();

    return () => controller.abort();
  }, [lang, impulseTransactions, impulseTranslations]);

  const fetchAnalysis = async (
    scope: 'month' | 'year' | 'custom',
    mode: 'auto' | 'manual',
    customStart?: string,
    customEnd?: string
  ) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ scope, budgetMode: mode });
      if (scope === 'custom' && customStart && customEnd) {
        params.set('startDate', customStart);
        params.set('endDate', customEnd);
      }
      const response = await fetch(`/api/analysis?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setBudgetSummary(data.budgetSummary);
        setImpulseTransactions(data.impulseTransactions);
        setGoals(data.goals);
        setPatterns(data.patterns);
      }
    } catch (error) {
      console.error('Error fetching analysis:', error);
    } finally {
      setLoading(false);
    }
  };

  const openDepositDialog = (goal: SavingsGoal) => {
    setSelectedGoal(goal);
    setDepositAmount('');
    setShowDepositDialog(true);
  };

  const saveDeposit = async () => {
    if (!selectedGoal) return;
    const amount = Number(depositAmount);
    if (Number.isNaN(amount) || amount <= 0) return;

    try {
      const res = await fetch('/api/goals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goalId: selectedGoal.id, amount, mode: 'deposit' }),
      });
      const data = await res.json();
      if (data.success) {
        setGoals(data.goals);
        setShowDepositDialog(false);
      }
    } catch (error) {
      console.error('Error saving deposit:', error);
    }
  };

  const deleteGoal = async (goalId: string) => {
    try {
      const res = await fetch('/api/goals', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goalId }),
      });
      const data = await res.json();
      if (data.success) {
        setGoals(data.goals);
      }
    } catch (error) {
      console.error('Error deleting goal:', error);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <p className="text-center text-gray-600">{t('analyse.loading', 'Lade Analyse...')}</p>
      </div>
    );
  }

  const budgetPercentage =
    budgetSummary && budgetSummary.monthlyBudget > 0
      ? Math.min(100, (budgetSummary.usedBudget / budgetSummary.monthlyBudget) * 100)
      : 0;
  const overBudget =
    budgetSummary && budgetSummary.monthlyBudget > 0
      ? budgetSummary.usedBudget > budgetSummary.monthlyBudget
      : false;
  const remaining = budgetSummary
    ? Math.max(0, budgetSummary.monthlyBudget - budgetSummary.usedBudget)
    : 0;
  const overrun = budgetSummary
    ? Math.max(0, budgetSummary.usedBudget - budgetSummary.monthlyBudget)
    : 0;

  const submitImpulseJustification = async (transactionId: string) => {
    const note = impulseNotes[transactionId] || '';
    setSavingImpulseId(transactionId);
    try {
      const res = await fetch('/api/impulse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId, justification: note }),
      });
      const data = await res.json();
      if (data.success && data.transaction) {
        setImpulseTransactions((prev) => prev.filter((t) => t.id !== transactionId));
        // Refresh analysis to update budget + byCategory
        fetchAnalysis(timeframe, budgetMode, appliedStartDate, appliedEndDate);
      }
    } catch (err) {
      console.error('Error submitting impulse justification:', err);
    } finally {
      setSavingImpulseId(null);
    }
  };

  const translateCategory = (category: string) => {
    const entry = CATEGORY_LABELS[category];
    if (!entry) return category;
    return lang === 'en' ? entry.en : entry.de;
  };

  const translatePattern = (pattern: string) => {
    if (lang !== 'en') return pattern;
    const cached = patternTranslations[pattern];
    if (cached && cached !== pattern) return cached;

    const dayMap: Record<string, string> = {
      Sonntag: 'Sunday',
      Montag: 'Monday',
      Dienstag: 'Tuesday',
      Mittwoch: 'Wednesday',
      Donnerstag: 'Thursday',
      Freitag: 'Friday',
      Samstag: 'Saturday',
    };

    if (pattern.startsWith('Noch keine Ausgaben')) {
      return 'No spending for this period yet.';
    }

    if (pattern.startsWith('Gute Pace')) {
      return 'Good pace: you are below your planned budget trajectory.';
    }

    const dayMatch = pattern.match(
      /(Sonntag|Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag)[^0-9\-−+]*Durchschnitt\s+([\-−]?[0-9.,]+)\s*CHF/i
    );
    if (dayMatch) {
      const [, day, avg] = dayMatch;
      return `${dayMap[day] ?? day} is your most expensive day (avg ${avg} CHF).`;
    }

    const impulseRateMatch = pattern.match(/(\d+)% deiner Käufe sind Impulskäufe/i);
    if (impulseRateMatch) {
      const [, rate] = impulseRateMatch;
      return `${rate}% of your purchases are impulse buys. Try pausing before buying.`;
    }

    if (pattern.startsWith('Zwischen 22:00 und 02:00 machst du viele Impulskäufe')) {
      return 'Many impulse buys between 22:00 and 02:00. Consider a no-buy rule after 10pm.';
    }

    const topCatMatch = pattern.match(/^(.*)\s+macht\s+([\d.,]+)%\s+deiner Ausgaben aus\s+\(([\d.,]+)\s*CHF\)\.?$/i);
    if (topCatMatch) {
      const [, category, percent, amount] = topCatMatch;
      return `${translateCategory(category)} accounts for ${percent}% of your spending (${amount} CHF).`;
    }

    const looseCatMatch = pattern.match(/(.+?)macht\s+([\d.,]+)%.*\(([\d.,]+)\s*CHF\)/i);
    if (looseCatMatch) {
      const [, category, percent, amount] = looseCatMatch;
      return `${translateCategory(category.trim())} accounts for ${percent}% of your spending (${amount} CHF).`;
    }

    return pattern;
  };

  const translateRule = (rule: string, ruleEn?: string) => {
    if (lang !== 'en') return rule;
    if (ruleEn) return ruleEn;
    const monthlySavingsMatch = rule.match(/^Jeden Monat\s+([\d.,]+)\s*CHF aufs Sparkonto überweisen/i);
    if (monthlySavingsMatch) return `Transfer ${monthlySavingsMatch[1]} CHF to savings each month`;

    const eatOutMatch = rule.match(/^Essen gehen maximal\s+(\d+)x\s*(?:pro\s*)?(Woche|Monat)/i);
    if (eatOutMatch) {
      const unit = eatOutMatch[2].toLowerCase() === 'monat' ? 'month' : 'week';
      return `Eat out at most ${eatOutMatch[1]}x per ${unit}`;
    }

    const shoppingMatch = rule.match(/^Shopping maximal\s+([\d.,]+)\s*CHF pro Monat/i);
    if (shoppingMatch) return `Shopping max ${shoppingMatch[1]} CHF per month`;

    const cooldownMatch = rule.match(/^Vor jedem Kauf über\s+([\d.,]+)\s*CHF:? ?24h Bedenkzeit/i);
    if (cooldownMatch) return `For every purchase over ${cooldownMatch[1]} CHF: 24h cooling-off period`;

    const foodDeliveryMatch = rule.match(/^Food Delivery maximal\s+(\d+)x pro Woche/i);
    if (foodDeliveryMatch) return `Food delivery at most ${foodDeliveryMatch[1]}x per week`;

    return ruleTranslations[rule] ?? rule;
  };

  const translateImpulse = (text: string) => {
    if (lang !== 'en') return text;
    if (text.includes('Hoher Betrag') && text.includes('Kleidung')) {
      return 'High amount for clothing without a clear need. Likely an impulse buy because it was not planned.';
    }
    if (text.includes('Spontaner Besuch bei Burger King')) {
      return 'Spontaneous Burger King visit without a real need. Cooking at home would have been cheaper.';
    }
    if (text.includes('Kauf war nicht geplant') || text.includes('spontanen Wunsch')) {
      return 'The purchase was unplanned and based on a spontaneous desire.';
    }
    return impulseTranslations[text] ?? text;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            {t('analyse.title', 'Deine Ausgaben Analyse')}
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mt-1">
            {t('analyse.subtitle', 'Überblick über dein aktuelles Budget und Ausgabeverhalten')}
          </p>
        </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 text-gray-900 dark:text-gray-100">
            <div className="flex flex-col text-sm text-gray-700">
            <span>{t('analyse.timeframe', 'Zeitraum')}</span>
            <select
              className="border rounded px-2 py-1 text-sm"
              value={timeframe}
              onChange={(e) => {
                const raw = e.target.value;
                const next = raw === 'year' ? 'year' : raw === 'custom' ? 'custom' : 'month';
                setTimeframe(next);
                if (next === 'custom' && !startDate && !endDate) {
                  const today = new Date();
                  const start = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
                  const end = today.toISOString().split('T')[0];
                  setStartDate(start);
                  setEndDate(end);
                }
              }}
            >
              <option value="month">{t('analyse.timeframe.month', 'Aktueller Monat')}</option>
              <option value="year">{t('analyse.timeframe.year', 'Ganzes Jahr')}</option>
              <option value="custom">{t('analyse.timeframe.custom', 'Eigener Zeitraum')}</option>
            </select>
          </div>
          <div className="flex flex-col text-sm text-gray-700">
            <span>{t('analyse.budgetMode', 'Budget-Berechnung')}</span>
            <select
              className="border rounded px-2 py-1 text-sm"
              value={budgetMode}
              onChange={(e) => {
                const next = e.target.value === 'manual' ? 'manual' : 'auto';
                setBudgetMode(next);
                if (typeof window !== 'undefined') localStorage.setItem('budgetMode', next);
              }}
            >
              <option value="auto">{t('analyse.budgetMode.auto', 'Automatisch (Lohnhistorie)')}</option>
              <option value="manual">{t('analyse.budgetMode.manual', 'Manuell (Budget-Dialog)')}</option>
            </select>
          </div>
          {timeframe === 'custom' && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex flex-col text-sm text-gray-700">
                <span>{t('analyse.from', 'Von')}</span>
                <input
                  type="date"
                  className="border rounded px-2 py-1 text-sm"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                  }}
                />
              </div>
              <div className="flex flex-col text-sm text-gray-700">
                <span>{t('analyse.to', 'Bis')}</span>
                <input
                  type="date"
                  className="border rounded px-2 py-1 text-sm"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                  }}
                />
              </div>
              <Button
                className="self-start sm:self-end mt-2 sm:mt-6"
                variant="secondary"
                size="sm"
                disabled={!startDate || !endDate || startDate > endDate}
                onClick={() => {
                  if (!startDate || !endDate || startDate > endDate) return;
                  setAppliedStartDate(startDate);
                  setAppliedEndDate(endDate);
                  if (typeof window !== 'undefined') {
                    localStorage.setItem('analysisStartDate', startDate);
                    localStorage.setItem('analysisEndDate', endDate);
                  }
                }}
              >
                {t('analyse.applyRange', 'Zeitraum anwenden')}
              </Button>
              {(!startDate || !endDate || startDate > endDate) && (
                <p className="text-xs text-red-600">{t('analyse.range.invalid', 'Bitte gültigen Zeitraum wählen.')}</p>
              )}
            </div>
          )}
      </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {t('analyse.budgetTitle', 'Budgetübersicht')}{' '}
            {timeframe === 'year'
              ? t('analyse.timeframe.year', 'Jahr')
              : timeframe === 'custom'
              ? t('analyse.timeframe.custom', 'Zeitraum')
              : t('analyse.timeframe.month', 'Monat')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">{t('analyse.used', 'Genutzt (Ausgaben)')}</span>
              <span className="font-bold text-lg">
                {budgetSummary?.usedBudget.toFixed(2)} CHF / {budgetSummary?.monthlyBudget.toFixed(2)} CHF
              </span>
            </div>
            <Progress
              value={budgetPercentage}
              className="h-3"
              indicatorClassName={overBudget ? 'bg-red-500' : 'bg-primary'}
            />
            <div className="text-xs text-gray-700 flex items-center justify-between">
              <span>
                {overBudget
                  ? `${t('analyse.budget.over', 'Budgetüberzug')}: ${overrun.toFixed(2)} CHF`
                  : `${t('analyse.budget.remaining', 'Restbudget')}: ${remaining.toFixed(2)} CHF`}
              </span>
              <span className="text-gray-500">
                {timeframe === 'year'
                  ? t('analyse.timeframe.year', 'Jahr')
                  : timeframe === 'custom'
                  ? t('analyse.timeframe.custom', 'Zeitraum')
                  : t('analyse.timeframe.month', 'Monat')}{' '}
                · {t('analyse.basis', 'Basis')}: {budgetMode === 'manual' ? t('analyse.manual', 'manuell') : t('analyse.salaryBasis', 'Lohnsumme im Zeitraum')}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-4">{t('analyse.byCategory', 'Ausgaben nach Kategorie')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {budgetSummary?.byCategory.map((cat) => {
            const Icon = CATEGORY_ICONS[cat.category] || Package;
            return (
              <Card key={cat.category}>
                <CardContent className="pt-6">
                  <div className="flex items-center space-x-3">
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <Icon className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">{translateCategory(cat.category)}</p>
                      <p className="text-lg font-bold text-gray-900">{cat.amount.toFixed(2)} CHF</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {goals.length > 0 && (
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4">{t('analyse.goals', 'Dein Sparplan')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {goals.map((goal) => {
              const progress = (goal.currentSavedAmount / goal.targetAmount) * 100;
              return (
                <Card key={goal.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between space-x-2">
                      <div className="flex items-center space-x-2">
                        <Target className="w-5 h-5 text-blue-600" />
                        <span>{goal.title}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button size="icon" variant="ghost" onClick={() => openDepositDialog(goal)} title={t('analyse.addDeposit', 'Einzahlen')}>
                          <Plus className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => deleteGoal(goal.id)} title={t('analyse.delete', 'Entfernen')}>
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-600">{t('analyse.progress', 'Fortschritt')}</span>
                        <span className="font-medium">
                          {goal.currentSavedAmount} CHF / {goal.targetAmount} CHF
                        </span>
                      </div>
                      <Progress value={progress} className="h-2" />
                      <p className="text-xs text-gray-500 mt-1">
                        {t('analyse.target', 'Ziel')}: {new Date(goal.targetDate).toLocaleDateString('de-CH')}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-2">{t('analyse.rules', 'Verhaltensregeln:')}</p>
                      <ul className="space-y-1.5">
                        {goal.rules.map((rule, idx) => (
                          <li key={idx} className="text-sm text-gray-600 flex items-start">
                            <span className="text-green-600 mr-2">✓</span>
                            <span>{translateRule(rule, goal.rulesEn?.[idx])}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {patterns.length > 0 && (
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            {t('analyse.patterns', 'Muster & Nudges')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {patterns.map((pattern, idx) => (
              <Card key={idx}>
                <CardContent className="pt-6">
                  <div className="flex items-start space-x-3">
                    <div className="p-2 bg-yellow-50 rounded-lg mt-1">
                      <TrendingUp className="w-5 h-5 text-yellow-600" />
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed">{translatePattern(pattern)}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {impulseTransactions.length > 0 && (
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            {t('analyse.impulses', 'Erkannte Impulskäufe')}
          </h2>
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                {impulseTransactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="flex items-start justify-between p-4 bg-red-50 dark:bg-red-900/30 rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <p className="font-semibold text-gray-900 dark:text-gray-100">{transaction.merchant}</p>
                        <Badge variant="destructive" className="text-xs">
                          {t('analyse.impulseBadge', 'Impulskauf erkannt')}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">
                        {translateCategory(transaction.category)}
                      </p>
                      <p className="text-sm text-gray-700 dark:text-gray-200">
                        {lang === 'en' && transaction.decisionExplanationEn
                          ? transaction.decisionExplanationEn
                          : translateImpulse(transaction.decisionExplanation)}
                      </p>
                      <div className="mt-3 space-y-2">
                        <label className="text-xs font-medium text-gray-700 dark:text-gray-200">
                          {t('analyse.impulseJustify.label', 'Impulskauf begründen')}
                        </label>
                        <textarea
                          className="w-full border rounded px-2 py-1 text-sm bg-white dark:bg-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-700"
                          placeholder={t(
                            'analyse.impulseJustify.placeholder',
                            'Warum war dieser Kauf notwendig oder geplant?'
                          )}
                          value={impulseNotes[transaction.id] ?? ''}
                          onChange={(e) =>
                            setImpulseNotes((prev) => ({ ...prev, [transaction.id]: e.target.value }))
                          }
                        />
                        <Button
                          size="sm"
                          onClick={() => submitImpulseJustification(transaction.id)}
                          disabled={savingImpulseId === transaction.id}
                        >
                          {savingImpulseId === transaction.id
                            ? t('analyse.loading', 'Lade Analyse...')
                            : t('analyse.impulseJustify.submit', 'Begründung senden')}
                        </Button>
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <p className="text-lg font-bold text-red-600">{transaction.amount.toFixed(2)} CHF</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{new Date(transaction.date).toLocaleDateString('de-CH')}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={showDepositDialog} onOpenChange={setShowDepositDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('analyse.addDeposit', 'Einzahlung auf Sparziel')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-gray-700">
              {t('analyse.goalLabel', 'Ziel')}: <span className="font-semibold">{selectedGoal?.title}</span>
            </p>
            <Input
              type="number"
              step="0.01"
              placeholder={t('analyse.depositPlaceholder', 'Betrag in CHF')}
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
            />
            <p className="text-xs text-gray-500">{t('analyse.depositHint', 'Erhöht den aktuellen Sparstand.')}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDepositDialog(false)}>
              {t('analyse.cancel', 'Abbrechen')}
            </Button>
            <Button onClick={saveDeposit} disabled={!depositAmount}>
              {t('analyse.save', 'Speichern')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
