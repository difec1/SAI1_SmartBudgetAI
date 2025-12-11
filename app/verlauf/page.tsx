'use client';

import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import TransactionForm from '@/components/TransactionForm';
import type { Transaction } from '@/lib/types';

export default function VerlaufPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [budgetInfo, setBudgetInfo] = useState({ used: 0, total: 0 });

  useEffect(() => {
    fetchTransactions();
    fetchBudgetInfo();
  }, []);

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

  const fetchBudgetInfo = async () => {
    try {
      const response = await fetch('/api/analysis');
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
  };

  const handleFormSuccess = () => {
    fetchTransactions();
    fetchBudgetInfo();
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <p className="text-center text-gray-600">Lade Transaktionen...</p>
      </div>
    );
  }

  const budgetPercentage = budgetInfo.total > 0 ? (budgetInfo.used / budgetInfo.total) * 100 : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Verlauf deiner analysierten Einkäufe</h1>
          <p className="text-gray-600 mt-1">Alle deine Transaktionen mit KI-Analyse</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="flex items-center space-x-2">
          <Plus className="w-5 h-5" />
          <span>Neue Transaktion</span>
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Monatliches Budget</span>
              <span className="font-bold">
                {budgetInfo.used.toFixed(2)} CHF / {budgetInfo.total.toFixed(2)} CHF
              </span>
            </div>
            <Progress value={budgetPercentage} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {transactions.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center py-12">
            <p className="text-gray-600 mb-4">Noch keine Transaktionen erfasst.</p>
            <Button onClick={() => setShowForm(true)}>Erste Transaktion hinzufügen</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {transactions.map((transaction) => {
            const isUseful = transaction.decisionLabel === 'useful';

            return (
              <Card key={transaction.id} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <div>
                          <h3 className="font-semibold text-gray-900">{transaction.merchant}</h3>
                          <p className="text-sm text-gray-500">
                            {new Date(transaction.date).toLocaleDateString('de-CH', {
                              weekday: 'short',
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                            })}
                          </p>
                        </div>
                        <Badge variant={isUseful ? 'default' : 'secondary'} className="text-xs">
                          {transaction.category}
                        </Badge>
                        {transaction.isImpulse && (
                          <Badge variant="destructive" className="text-xs">
                            Impulskauf
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-start space-x-2 mb-2">
                        <div
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            isUseful
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {isUseful ? 'Eher sinnvoller Kauf' : 'Eher unnötiger Kauf'}
                        </div>
                      </div>

                      <p className="text-sm text-gray-700 leading-relaxed">
                        {transaction.decisionExplanation}
                      </p>

                      {transaction.justification && (
                        <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-600">
                          <span className="font-medium">Deine Begründung:</span> {transaction.justification}
                        </div>
                      )}
                    </div>

                    <div className="text-right ml-6">
                      <p className={`text-2xl font-bold ${
                        isUseful ? 'text-gray-900' : 'text-red-600'
                      }`}>
                        {transaction.amount.toFixed(2)} CHF
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {showForm && (
        <TransactionForm
          onClose={() => setShowForm(false)}
          onSuccess={handleFormSuccess}
        />
      )}
    </div>
  );
}
