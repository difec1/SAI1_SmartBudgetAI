'use client';

import { useState, useEffect } from 'react';
import { ShoppingBag, Truck, Utensils, Tv, Package, AlertCircle, Target, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import type { BudgetSummary, Transaction, SavingsGoal } from '@/lib/types';

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
  const [budgetSummary, setBudgetSummary] = useState<BudgetSummary | null>(null);
  const [impulseTransactions, setImpulseTransactions] = useState<Transaction[]>([]);
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [patterns, setPatterns] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalysis();
  }, []);

  const fetchAnalysis = async () => {
    try {
      const response = await fetch('/api/analysis');
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

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <p className="text-center text-gray-600">Lade Analyse...</p>
      </div>
    );
  }

  const budgetPercentage = budgetSummary
    ? (budgetSummary.usedBudget / budgetSummary.monthlyBudget) * 100
    : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Deine Ausgaben Analyse</h1>
        <p className="text-gray-600 mt-1">Überblick über dein aktuelles Budget und Ausgabeverhalten</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Budgetübersicht Monat</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Genutzt</span>
              <span className="font-bold text-lg">
                {budgetSummary?.usedBudget.toFixed(2)} CHF / {budgetSummary?.monthlyBudget.toFixed(2)} CHF
              </span>
            </div>
            <Progress value={budgetPercentage} className="h-3" />
            <p className="text-xs text-gray-500">
              {budgetPercentage < 75
                ? 'Du bist gut im Budget!'
                : budgetPercentage < 90
                ? 'Achtung: Budget wird knapp'
                : 'Budget überschritten!'}
            </p>
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

      {impulseTransactions.length > 0 && (
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4">Erkannte Impulskäufe</h2>
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                {impulseTransactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="flex items-start justify-between p-4 bg-red-50 rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <p className="font-semibold text-gray-900">{transaction.merchant}</p>
                        <Badge variant="destructive" className="text-xs">
                          Impulskauf erkannt
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-1">{transaction.category}</p>
                      <p className="text-sm text-gray-700">{transaction.decisionExplanation}</p>
                    </div>
                    <div className="text-right ml-4">
                      <p className="text-lg font-bold text-red-600">{transaction.amount.toFixed(2)} CHF</p>
                      <p className="text-xs text-gray-500">{new Date(transaction.date).toLocaleDateString('de-CH')}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {goals.length > 0 && (
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4">Dein Sparplan</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {goals.map((goal) => {
              const progress = (goal.currentSavedAmount / goal.targetAmount) * 100;
              return (
                <Card key={goal.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Target className="w-5 h-5 text-blue-600" />
                      <span>{goal.title}</span>
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
    </div>
  );
}
