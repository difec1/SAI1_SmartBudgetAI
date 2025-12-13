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
import { useRequireAuth } from '@/hooks/useAuth';

const CATEGORY_ICONS: Record<string, any> = {
  Shopping: ShoppingBag,
  'Food Delivery': Utensils,
  Transport: Truck,
  Unterhaltung: Tv,
  Lebensmittel: Package,
  Gesundheit: AlertCircle,
  Sonstiges: Package,
};

export default function AnalysePage() {
  const { session } = useRequireAuth();
  const [budgetSummary, setBudgetSummary] = useState<BudgetSummary | null>(null);
  const [impulseTransactions, setImpulseTransactions] = useState<Transaction[]>([]);
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [patterns, setPatterns] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGoal, setSelectedGoal] = useState<SavingsGoal | null>(null);
  const [depositAmount, setDepositAmount] = useState('');
  const [showDepositDialog, setShowDepositDialog] = useState(false);
  const [timeframe, setTimeframe] = useState<'month' | 'year' | 'custom'>('month');
  const [budgetMode, setBudgetMode] = useState<'auto' | 'manual'>('auto');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  if (session === undefined) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <p className="text-center text-gray-600">Lade...</p>
      </div>
    );
  }

  useEffect(() => {
    // Lokale Präferenzen (Zeitraum/Budgetquelle) beim Laden wiederherstellen
    // Standardansicht: immer aktueller Monat, keine Wiederherstellung des Zeitraums
    const savedStart = typeof window !== 'undefined' ? localStorage.getItem('analysisStartDate') : null;
    const savedEnd = typeof window !== 'undefined' ? localStorage.getItem('analysisEndDate') : null;
    if (savedStart) setStartDate(savedStart);
    if (savedEnd) setEndDate(savedEnd);
    const savedBudgetMode = typeof window !== 'undefined' ? localStorage.getItem('budgetMode') : null;
    if (savedBudgetMode === 'manual') {
      setBudgetMode('manual');
    }
  }, []);

  useEffect(() => {
    if (!session?.access_token) {
      return;
    }
    const canFetch =
      timeframe !== 'custom' || (timeframe === 'custom' && startDate && endDate && startDate <= endDate);
    if (canFetch && session.access_token) {
      fetchAnalysis(timeframe, budgetMode, startDate, endDate, session.access_token);
    } else {
      setLoading(false);
    }
  }, [timeframe, budgetMode, startDate, endDate, session?.access_token]);

  const fetchAnalysis = async (
    scope: 'month' | 'year' | 'custom',
    mode: 'auto' | 'manual',
    customStart?: string,
    customEnd?: string,
    accessToken?: string
  ) => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ scope, budgetMode: mode });
      if (scope === 'custom' && customStart && customEnd) {
        params.set('startDate', customStart);
        params.set('endDate', customEnd);
      }
      const response = await fetch(`/api/analysis?${params.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
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
      if (!session?.access_token) return;
      const res = await fetch('/api/goals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
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
      if (!session?.access_token) return;
      const res = await fetch('/api/goals', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
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
        <p className="text-center text-gray-600">Lade Analyse...</p>
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

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Deine Ausgaben Analyse</h1>
          <p className="text-gray-600 dark:text-gray-300 mt-1">Überblick über dein aktuelles Budget und Ausgabeverhalten</p>
        </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 text-gray-900 dark:text-gray-100">
            <div className="flex flex-col text-sm text-gray-700">
            <span>Zeitraum</span>
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
              <option value="month">Aktueller Monat</option>
              <option value="year">Ganzes Jahr</option>
              <option value="custom">Eigener Zeitraum</option>
            </select>
          </div>
          <div className="flex flex-col text-sm text-gray-700">
            <span>Budget-Berechnung</span>
            <select
              className="border rounded px-2 py-1 text-sm"
              value={budgetMode}
              onChange={(e) => {
                const next = e.target.value === 'manual' ? 'manual' : 'auto';
                setBudgetMode(next);
                if (typeof window !== 'undefined') localStorage.setItem('budgetMode', next);
              }}
            >
              <option value="auto">Automatisch (Lohnhistorie)</option>
              <option value="manual">Manuell (Budget-Dialog)</option>
            </select>
          </div>
          {timeframe === 'custom' && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex flex-col text-sm text-gray-700">
                <span>Von</span>
                <input
                  type="date"
                  className="border rounded px-2 py-1 text-sm"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    if (typeof window !== 'undefined') localStorage.setItem('analysisStartDate', e.target.value);
                  }}
                />
              </div>
              <div className="flex flex-col text-sm text-gray-700">
                <span>Bis</span>
                <input
                  type="date"
                  className="border rounded px-2 py-1 text-sm"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    if (typeof window !== 'undefined') localStorage.setItem('analysisEndDate', e.target.value);
                  }}
                />
              </div>
              {(!startDate || !endDate || startDate > endDate) && (
                <p className="text-xs text-red-600">Bitte gültigen Zeitraum wählen.</p>
              )}
            </div>
          )}
      </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            Budgetübersicht{' '}
            {timeframe === 'year' ? 'Jahr' : timeframe === 'custom' ? 'Zeitraum' : 'Monat'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Genutzt (Ausgaben)</span>
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
                  ? `Budgetüberzug: ${overrun.toFixed(2)} CHF`
                  : `Restbudget: ${remaining.toFixed(2)} CHF`}
              </span>
              <span className="text-gray-500">
                {timeframe === 'year' ? 'Jahr' : timeframe === 'custom' ? 'Zeitraum' : 'Monat'} · Basis: {budgetMode === 'manual' ? 'manuell' : 'Lohnsumme im Zeitraum'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-4">Ausgaben nach Kategorie</h2>
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
                      <p className="text-sm text-gray-600">{cat.category}</p>
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
          <h2 className="text-xl font-bold text-gray-900 mb-4">Dein Sparplan</h2>
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
                        <Button size="icon" variant="ghost" onClick={() => openDepositDialog(goal)} title="Einzahlen">
                          <Plus className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => deleteGoal(goal.id)} title="Entfernen">
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-600">Fortschritt</span>
                        <span className="font-medium">
                          {goal.currentSavedAmount} CHF / {goal.targetAmount} CHF
                        </span>
                      </div>
                      <Progress value={progress} className="h-2" />
                      <p className="text-xs text-gray-500 mt-1">
                        Ziel: {new Date(goal.targetDate).toLocaleDateString('de-CH')}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-2">Verhaltensregeln:</p>
                      <ul className="space-y-1.5">
                        {goal.rules.map((rule, idx) => (
                          <li key={idx} className="text-sm text-gray-600 flex items-start">
                            <span className="text-green-600 mr-2">✓</span>
                            <span>{rule}</span>
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
          <h2 className="text-xl font-bold text-gray-900 mb-4">Erkannte Muster & Nudges</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {patterns.map((pattern, idx) => (
              <Card key={idx}>
                <CardContent className="pt-6">
                  <div className="flex items-start space-x-3">
                    <div className="p-2 bg-yellow-50 rounded-lg mt-1">
                      <TrendingUp className="w-5 h-5 text-yellow-600" />
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed">{pattern}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {impulseTransactions.length > 0 && (
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4">Erkannte Impulskäufe</h2>
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
                          Impulskauf erkannt
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">{transaction.category}</p>
                      <p className="text-sm text-gray-700 dark:text-gray-200">{transaction.decisionExplanation}</p>
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
            <DialogTitle>Einzahlung auf Sparziel</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-gray-700">
              Ziel: <span className="font-semibold">{selectedGoal?.title}</span>
            </p>
            <Input
              type="number"
              step="0.01"
              placeholder="Betrag in CHF"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
            />
            <p className="text-xs text-gray-500">Erhöht den aktuellen Sparstand.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDepositDialog(false)}>
              Abbrechen
            </Button>
            <Button onClick={saveDeposit} disabled={!depositAmount}>
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
