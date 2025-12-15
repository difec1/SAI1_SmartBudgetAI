'use client';

/**
 * Verlauf-Seite:
 * - Listet alle Transaktionen mit KI-Erläuterung.
 * - Filter (Suche, Kategorie, Typ, Zeitraum) und Sortierung.
 * - Budgetkarte (auto/manuell) + Kategorieanpassung je Eintrag.
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { Transaction } from '@/lib/types';
import { useI18n } from '@/hooks/useI18n';

const CATEGORY_LABELS: Record<string, { de: string; en: string }> = {
  Abos: { de: 'Abos', en: 'Subscriptions' },
  Allgemeines: { de: 'Allgemeines', en: 'General' },
  Bargeldbezug: { de: 'Bargeldbezug', en: 'Cash withdrawal' },
  Bildung: { de: 'Bildung', en: 'Education' },
  Gastronomie: { de: 'Gastronomie', en: 'Dining' },
  Gesundheit: { de: 'Gesundheit', en: 'Health' },
  Lebensmittel: { de: 'Lebensmittel', en: 'Groceries' },
  Lohn: { de: 'Lohn', en: 'Salary' },
  'Mobilität - Auto': { de: 'Mobilität - Auto', en: 'Transport - Car' },
  'Mobilität - Öffentlicher Verkehr': { de: 'Mobilität - Öffentlicher Verkehr', en: 'Transport - Public' },
  Persönliches: { de: 'Persönliches', en: 'Personal' },
  Reisen: { de: 'Reisen', en: 'Travel' },
  Shopping: { de: 'Shopping', en: 'Shopping' },
  'Sparen & Anlegen': { de: 'Sparen & Anlegen', en: 'Saving & Investing' },
  Steuern: { de: 'Steuern', en: 'Taxes' },
  Unterhaltung: { de: 'Unterhaltung', en: 'Entertainment' },
  'Weitere Einnahmen': { de: 'Weitere Einnahmen', en: 'Other income' },
  Wohnen: { de: 'Wohnen', en: 'Housing' },
  Zahlungen: { de: 'Zahlungen', en: 'Payments' },
};

const BASE_CATEGORIES = [
  'Abos',
  'Allgemeines',
  'Bargeldbezug',
  'Bildung',
  'Gastronomie',
  'Gesundheit',
  'Lebensmittel',
  'Lohn',
  'Mobilität - Auto',
  'Mobilität - Öffentlicher Verkehr',
  'Persönliches',
  'Reisen',
  'Shopping',
  'Sparen & Anlegen',
  'Steuern',
  'Unterhaltung',
  'Weitere Einnahmen',
  'Wohnen',
  'Zahlungen',
];

const CATEGORY_OPTIONS = Array.from(new Set(BASE_CATEGORIES)).sort((a, b) =>
  a.localeCompare(b, 'de')
);

const INCOME_KEYWORDS = ['lohn', 'salär', 'salaer', 'gehalt', 'salary', 'payroll', 'einkommen', 'einnahme', 'bonus', 'wage'];

export default function VerlaufPage() {
  const { t, lang } = useI18n();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [budgetInfo, setBudgetInfo] = useState({ used: 0, total: 0 });
  const [decisionTranslations, setDecisionTranslations] = useState<Record<string, string>>({});
  const [impulseNotes, setImpulseNotes] = useState<Record<string, string>>({});
  const [savingImpulseId, setSavingImpulseId] = useState<string | null>(null);
  const [showBudgetDialog, setShowBudgetDialog] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');
  const [savingBudget, setSavingBudget] = useState(false);
  const [categoryEdits, setCategoryEdits] = useState<Record<string, string>>({});
  const [savingCategoryId, setSavingCategoryId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [budgetMode, setBudgetMode] = useState<'auto' | 'manual'>('auto');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortBy, setSortBy] = useState<
    'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc'
  >('date-desc');

  useEffect(() => {
    fetchTransactions();
  }, []);

  useEffect(() => {
    if (lang !== 'en' || transactions.length === 0) return;
    const uniqueExplanations = Array.from(new Set(transactions.map((t) => t.decisionExplanation).filter(Boolean)));
    const missing = uniqueExplanations.filter((text) => !decisionTranslations[text]);
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
          setDecisionTranslations((prev) => {
            const next = { ...prev };
            missing.forEach((text, idx) => {
              if (data.translations[idx]) next[text] = data.translations[idx];
            });
            return next;
          });
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error('Error translating decision explanations:', err);
      }
    })();

    return () => controller.abort();
  }, [lang, transactions, decisionTranslations]);

  useEffect(() => {
    const savedMode = typeof window !== 'undefined' ? localStorage.getItem('budgetMode') : null;
    if (savedMode === 'manual') {
      setBudgetMode('manual');
    }
  }, []);

  const fetchBudgetInfo = useCallback(
    async (mode: 'auto' | 'manual' = budgetMode) => {
      try {
        const params = new URLSearchParams({ scope: 'month', budgetMode: mode });
        const response = await fetch(`/api/analysis?${params.toString()}`);
        const data = await response.json();

        if (data.success && data.budgetSummary) {
          setBudgetInfo({
            used: data.budgetSummary.usedBudget,
            total: data.budgetSummary.monthlyBudget,
          });
        }
      } catch (error) {
        console.error('Error fetching budget info:', error);
      }
    },
    [budgetMode]
  );

  useEffect(() => {
    fetchBudgetInfo();
  }, [fetchBudgetInfo]);

  const fetchTransactions = async () => {
    try {
      const response = await fetch('/api/transactions');
      const data = await response.json();

      if (data.success) {
        setTransactions(data.transactions);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const isIncomeTransaction = (transaction: Transaction) => {
    const text = `${transaction.merchant} ${transaction.rawCategory ?? ''} ${transaction.justification ?? ''} ${transaction.category}`.toLowerCase();
    return (
      INCOME_KEYWORDS.some((kw) => text.includes(kw)) ||
      transaction.category === 'Lohn' ||
      transaction.category === 'Weitere Einnahmen' ||
      transaction.category === 'Einnahmen'
    );
  };

  // Filter-Logik für die Verlaufsliste (Suche, Typ, Kategorie)
  const filteredTransactions = transactions.filter((transaction) => {
    const matchesCategory = filterCategory ? transaction.category === filterCategory : true;
    const incomeFlag = isIncomeTransaction(transaction);
    const matchesType =
      filterType === 'all' ? true : filterType === 'income' ? incomeFlag : !incomeFlag;
    const term = searchTerm.trim().toLowerCase();
    const matchesSearch = term
      ? `${transaction.merchant} ${transaction.category} ${transaction.justification ?? ''}`
          .toLowerCase()
          .includes(term)
      : true;
    const matchesStart = startDate ? transaction.date >= startDate : true;
    const matchesEnd = endDate ? transaction.date <= endDate : true;
    return matchesCategory && matchesType && matchesSearch && matchesStart && matchesEnd;
  });

  const sortedTransactions = [...filteredTransactions].sort((a, b) => {
    const amountA = Math.abs(a.amount);
    const amountB = Math.abs(b.amount);
    switch (sortBy) {
      case 'date-asc':
        return a.date.localeCompare(b.date);
      case 'date-desc':
        return b.date.localeCompare(a.date);
      case 'amount-asc':
        return amountA - amountB;
      case 'amount-desc':
        return amountB - amountA;
      default:
        return 0;
    }
  });

  const hasTransactions = transactions.length > 0;
  const hasFilteredResults = sortedTransactions.length > 0;

  const openBudgetDialog = () => {
    setBudgetInput(budgetInfo.total ? budgetInfo.total.toString() : '');
    setShowBudgetDialog(true);
  };

  const saveBudget = async () => {
    const parsed = Number(budgetInput);
    if (Number.isNaN(parsed) || parsed < 0) return;

    setSavingBudget(true);
    try {
      const response = await fetch('/api/user', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monthlyBudget: parsed }),
      });

      const data = await response.json();
      if (data.success) {
        setBudgetMode('manual');
        if (typeof window !== 'undefined') {
          localStorage.setItem('budgetMode', 'manual');
        }
        await fetchBudgetInfo('manual');
        setShowBudgetDialog(false);
      }
    } catch (error) {
      console.error('Error updating budget:', error);
    } finally {
      setSavingBudget(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <p className="text-center text-gray-600">{t('verlauf.loading', 'Lade Transaktionen...')}</p>
      </div>
    );
  }

  const handleCategoryChange = (id: string, value: string) => {
    setCategoryEdits((prev) => ({ ...prev, [id]: value }));
  };

  const saveCategory = async (transaction: Transaction) => {
    const category = categoryEdits[transaction.id] || transaction.category;
    setSavingCategoryId(transaction.id);
    try {
      const res = await fetch('/api/transactions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: transaction.id,
          category,
          decisionLabel: transaction.decisionLabel,
          decisionExplanation: `Manuell gesetzt auf ${category}`,
          isImpulse: transaction.isImpulse,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTransactions((prev) =>
          prev.map((t) => (t.id === transaction.id ? { ...t, category: category, decisionExplanation: data.transaction.decisionExplanation } : t))
        );
      }
    } catch (error) {
      console.error('Error updating category:', error);
    } finally {
      setSavingCategoryId(null);
    }
  };

  const budgetPercentage =
    budgetInfo.total > 0 ? Math.min(100, (budgetInfo.used / budgetInfo.total) * 100) : 0;
  const overBudget = budgetInfo.total > 0 ? budgetInfo.used > budgetInfo.total : false;
  const remaining = Math.max(0, budgetInfo.total - budgetInfo.used);
  const overrun = Math.max(0, budgetInfo.used - budgetInfo.total);

  const translateCategory = (category: string) => {
    const entry = CATEGORY_LABELS[category];
    if (!entry) return category;
    return lang === 'en' ? entry.en : entry.de;
  };

  const translateDecision = (text: string) => {
    if (lang !== 'en') return text;
    if (text.includes('Kauf war nicht geplant') || text.includes('spontanen Wunsch')) {
      return 'The purchase was unplanned and based on a spontaneous desire.';
    }
    return decisionTranslations[text] ?? text;
  };

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
        setTransactions((prev) => prev.map((t) => (t.id === transactionId ? data.transaction : t)));
      }
    } catch (err) {
      console.error('Error submitting impulse justification:', err);
    } finally {
      setSavingImpulseId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            {t('verlauf.title', 'Verlauf deiner analysierten Einkäufe')}
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mt-1">
            {t('verlauf.subtitle', 'Alle deine Transaktionen mit KI-Analyse')}
          </p>
        </div>
        <Button
          asChild
          className="flex items-center space-x-2 bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
        >
          <Link href="/eingabe">
            <Plus className="w-5 h-5" />
            <span>{t('verlauf.newTransaction', 'Neue Transaktion')}</span>
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <div className="space-y-2 w-full">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">{t('verlauf.budget.flex', 'Monatliches Budget (flexibel)')}</span>
                <span className="font-bold">
                  {budgetInfo.used.toFixed(2)} CHF / {budgetInfo.total.toFixed(2)} CHF
                </span>
              </div>
              <Progress
                value={budgetPercentage}
                className="h-2"
                indicatorClassName={overBudget ? 'bg-red-500' : 'bg-primary'}
              />
              <div className="text-xs text-gray-700 flex items-center justify-between">
                <span>
                  {overBudget
                    ? `${t('verlauf.budget.over', 'Überzogen')}: ${overrun.toFixed(2)} CHF`
                    : `${t('verlauf.budget.remaining', 'Verbleibend')}: ${remaining.toFixed(2)} CHF`}
                </span>
                <span className="text-gray-500">
                  {t('verlauf.basis', 'Basis')}: {budgetMode === 'manual' ? t('verlauf.manual', 'manuell') : t('verlauf.salary', 'Lohn (60%)')}
                </span>
              </div>
            </div>
            <div className="flex flex-col space-y-2 ml-4">
              <Button variant="outline" size="sm" onClick={openBudgetDialog}>
                {t('verlauf.budget.set', 'Budget anpassen')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setBudgetMode('auto');
                  if (typeof window !== 'undefined') localStorage.setItem('budgetMode', 'auto');
                  fetchBudgetInfo('auto');
                }}
              >
                {t('verlauf.auto', 'Auto (Lohnbasis)')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {hasTransactions && (
        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1">
                <label className="text-sm text-gray-700 dark:text-gray-200">{t('verlauf.search', 'Suche')}</label>
                <Input
                  placeholder={t('verlauf.search.placeholder', 'z.B. Migros, Netflix...')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-gray-700 dark:text-gray-200">{t('verlauf.category', 'Kategorie')}</label>
                <select
                  className="border rounded px-2 py-2 text-sm w-full bg-white dark:bg-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-700"
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                >
                  <option value="">{t('verlauf.category.all', 'Alle Kategorien')}</option>
                  {CATEGORY_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {translateCategory(opt)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm text-gray-700 dark:text-gray-200">{t('verlauf.type', 'Typ')}</label>
                <select
                  className="border rounded px-2 py-2 text-sm w-full bg-white dark:bg-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-700"
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as 'all' | 'income' | 'expense')}
                >
                  <option value="all">{t('verlauf.type.all', 'Alle')}</option>
                  <option value="expense">{t('verlauf.type.expenseOnly', 'Nur Ausgaben (-)')}</option>
                  <option value="income">{t('verlauf.type.incomeOnly', 'Nur Einnahmen (+)')}</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm text-gray-700 dark:text-gray-200">{t('verlauf.dateRange.from', 'Von')}</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-gray-700 dark:text-gray-200">{t('verlauf.dateRange.to', 'Bis')}</label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-gray-700 dark:text-gray-200">{t('verlauf.sort', 'Sortierung')}</label>
                <select
                  className="border rounded px-2 py-2 text-sm w-full bg-white dark:bg-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-700"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                >
                  <option value="date-desc">{t('verlauf.sort.dateDesc', 'Datum (neu → alt)')}</option>
                  <option value="date-asc">{t('verlauf.sort.dateAsc', 'Datum (alt → neu)')}</option>
                  <option value="amount-desc">{t('verlauf.sort.amountDesc', 'Betrag (hoch → tief)')}</option>
                  <option value="amount-asc">{t('verlauf.sort.amountAsc', 'Betrag (tief → hoch)')}</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!hasTransactions ? (
        <Card>
          <CardContent className="pt-6 text-center py-12">
            <p className="text-gray-600 mb-4">{t('verlauf.table.emptyState', 'Noch keine Transaktionen erfasst.')}</p>
            <Button asChild>
              <Link href="/eingabe">{t('verlauf.table.addFirst', 'Erste Transaktion hinzufügen')}</Link>
            </Button>
          </CardContent>
        </Card>
      ) : !hasFilteredResults ? (
        <Card>
          <CardContent className="pt-6 text-center py-8">
            <p className="text-gray-600">{t('verlauf.table.noResults', 'Keine Transaktionen für diese Filter.')}</p>
            <Button variant="ghost" size="sm" className="mt-2" onClick={() => { setFilterCategory(''); setFilterType('all'); setSearchTerm(''); }}>
              {t('verlauf.clearFilters', 'Filter zurücksetzen')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sortedTransactions.map((transaction) => {
            const isUseful = transaction.decisionLabel === 'useful';
            const isIncome = isIncomeTransaction(transaction);
            const amountLabel = `${isIncome ? '+' : '-'}${Math.abs(transaction.amount).toFixed(2)} CHF`;
            const decisionLabel = isIncome
              ? 'Einnahme'
              : isUseful
              ? 'Eher sinnvoller Kauf'
              : 'Eher unnötiger Kauf';

            return (
              <Card key={transaction.id} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <div>
                            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{transaction.merchant}</h3>
                          <p className="text-sm text-gray-500 dark:text-gray-300">
                            {new Date(transaction.date).toLocaleDateString('de-CH', {
                              weekday: 'short',
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                            })}
                          </p>
                        </div>
                        <Badge variant={isUseful ? 'default' : 'secondary'} className="text-xs">
                          {translateCategory(transaction.category)}
                        </Badge>
                            {transaction.isImpulse && (
                              <Badge variant="destructive" className="text-xs">
                                {lang === 'en' ? 'Impulse buy' : 'Impulskauf'}
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-start space-x-2 mb-2">
                            <div
                              className={`px-3 py-1 rounded-full text-xs font-medium ${
                                isIncome
                                  ? 'bg-green-100 text-green-700'
                                  : isUseful
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-red-100 text-red-700'
                              }`}
                            >
                              {lang === 'en'
                                ? isIncome
                                  ? 'Income'
                                  : isUseful
                                  ? 'Useful purchase'
                                  : 'Non-essential purchase'
                                : decisionLabel}
                            </div>
                          </div>

                          <p className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed">
                            {lang === 'en' && transaction.decisionExplanationEn
                              ? transaction.decisionExplanationEn
                              : translateDecision(transaction.decisionExplanation)}
                          </p>

                          {transaction.justification && (
                            <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-800 rounded text-xs text-gray-600 dark:text-gray-300">
                              <span className="font-medium">
                                {lang === 'en' ? 'Your justification:' : 'Deine Begründung:'}
                              </span>{' '}
                              {transaction.justification}
                            </div>
                          )}

                          {transaction.isImpulse && (
                            <div className="mt-3 space-y-2">
                              <label className="text-xs font-semibold text-gray-700 dark:text-gray-200">
                                {t('verlauf.impulseJustify.label', 'Impulskauf begründen')}
                              </label>
                              <textarea
                                className="w-full border rounded px-2 py-1 text-sm bg-white dark:bg-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-700"
                                placeholder={t(
                                  'verlauf.impulseJustify.placeholder',
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
                                  ? t('verlauf.table.saving', 'Speichere...')
                                  : t('verlauf.impulseJustify.submit', 'Begründung senden')}
                              </Button>
                            </div>
                          )}

                          <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded">
                            <p className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-2">
                              {lang === 'en' ? 'Adjust category' : 'Kategorie anpassen'}
                            </p>
                            <div className="flex items-center space-x-2">
                              <select
                                className="border rounded px-2 py-1 text-sm bg-white dark:bg-gray-900 dark:text-gray-100"
                                value={categoryEdits[transaction.id] ?? transaction.category}
                                onChange={(e) => handleCategoryChange(transaction.id, e.target.value)}
                              >
                                {CATEGORY_OPTIONS.map((opt) => (
                                  <option key={opt} value={opt}>
                                    {translateCategory(opt)}
                                  </option>
                                ))}
                              </select>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => saveCategory(transaction)}
                                disabled={savingCategoryId === transaction.id}
                              >
                                {savingCategoryId === transaction.id
                                  ? t('verlauf.table.saving', 'Speichere...')
                                  : t('verlauf.save', 'Speichern')}
                              </Button>
                            </div>
                          </div>
                        </div>

                        <div className="text-right ml-6">
                          <p className={`text-2xl font-bold ${isIncome ? 'text-green-700' : 'text-red-600'}`}>
                            {amountLabel}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showBudgetDialog} onOpenChange={setShowBudgetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('verlauf.budget.dialog.title', 'Budget anpassen')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm text-gray-700">{t('verlauf.budget.dialog.input', 'Monatliches Budget (CHF)')}</label>
            <Input
              type="number"
              value={budgetInput}
              onChange={(e) => setBudgetInput(e.target.value)}
              min={0}
            />
            <p className="text-xs text-gray-500">
              {lang === 'en'
                ? 'This budget overrides the automatically calculated value (60% of your average salary).'
                : 'Dieses Budget überschreibt den automatisch berechneten Wert (60% deines durchschnittlichen Lohnes).'}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBudgetDialog(false)}>
              {t('verlauf.cancel', 'Abbrechen')}
            </Button>
            <Button onClick={saveBudget} disabled={savingBudget}>
              {savingBudget ? t('verlauf.table.saving', 'Speichere...') : t('verlauf.save', 'Speichern')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
