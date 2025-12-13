'use client';

import { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { SavingsGoal } from '@/lib/types';

interface TransactionFormProps {
  onClose?: () => void;
  onSuccess: () => void;
  variant?: 'modal' | 'embedded';
  accessToken: string;
}

const defaultFormState = {
  date: new Date().toISOString().split('T')[0],
  merchant: '',
  amount: '',
  rawCategory: '',
  justification: '',
  savingsGoalId: '',
  allocateAmount: '',
};

export default function TransactionForm({ onClose, onSuccess, variant = 'modal', accessToken }: TransactionFormProps) {
  const [loading, setLoading] = useState(false);
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const isModal = variant === 'modal';
  const handleClose = onClose || (() => {});
  const [formData, setFormData] = useState(defaultFormState);

  useEffect(() => {
    const fetchGoals = async () => {
      if (!accessToken) return;
      try {
        const res = await fetch('/api/goals', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const data = await res.json();
        if (data.success) setGoals(data.goals);
      } catch (error) {
        console.error('Error fetching goals for form:', error);
      }
    };
    fetchGoals();
  }, [accessToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          ...formData,
          amount: parseFloat(formData.amount),
          allocateAmount: formData.allocateAmount ? parseFloat(formData.allocateAmount) : undefined,
          savingsGoalId: formData.savingsGoalId || undefined,
        }),
      });

      if (response.ok) {
        onSuccess();
        handleClose();
        setFormData(defaultFormState);
      } else {
        alert('Fehler beim Speichern der Transaktion');
      }
    } catch (error) {
      console.error('Error submitting transaction:', error);
      alert('Fehler beim Speichern der Transaktion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={
        isModal ? 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4' : ''
      }
    >
      <div
      className={
        isModal
          ? 'rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto bg-card text-card-foreground border border-border'
          : 'rounded-lg shadow-sm border border-border bg-card text-card-foreground max-w-2xl w-full'
      }
    >
        <div className="flex items-start justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Neue Transaktion</h2>
            {!isModal && (
              <p className="text-sm text-gray-500 mt-1">
                Erfasse manuell oder nutze den CSV-Upload auf dieser Seite.
              </p>
            )}
          </div>
          {isModal && (
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <Label htmlFor="date">Datum</Label>
            <Input
              id="date"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
            />
          </div>

          <div>
            <Label htmlFor="merchant">Händler / Geschäft *</Label>
            <Input
              id="merchant"
              type="text"
              placeholder="z.B. Coop, Zalando, SBB"
              value={formData.merchant}
              onChange={(e) => setFormData({ ...formData, merchant: e.target.value })}
              required
            />
          </div>

          <div>
            <Label htmlFor="amount">Betrag (CHF) *</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              required
            />
          </div>

          <div>
            <Label htmlFor="rawCategory">Kategorie (optional)</Label>
            <Input
              id="rawCategory"
              type="text"
              placeholder="z.B. Shopping, Lebensmittel"
              value={formData.rawCategory}
              onChange={(e) => setFormData({ ...formData, rawCategory: e.target.value })}
            />
            <p className="text-sm text-gray-500 mt-1">
              Die KI klassifiziert automatisch, aber du kannst hier einen Hinweis geben.
            </p>
          </div>

          <div>
            <Label htmlFor="justification">Begründung (optional)</Label>
            <Textarea
              id="justification"
              placeholder="Warum hast du diesen Kauf getätigt?"
              value={formData.justification}
              onChange={(e) => setFormData({ ...formData, justification: e.target.value })}
              rows={3}
            />
          </div>

          {goals.length > 0 && (
            <div className="space-y-3">
              <Label>Zuweisung zum Sparziel (optional)</Label>
              <Select
                value={formData.savingsGoalId}
                onValueChange={(value) => setFormData({ ...formData, savingsGoalId: value })}
              >
                <SelectTrigger className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-700">
                  <SelectValue placeholder="Sparziel auswählen (optional)" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700">
                  {goals.map((goal) => (
                    <SelectItem key={goal.id} value={goal.id}>
                      {goal.title} ({goal.currentSavedAmount} / {goal.targetAmount} CHF)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                step="0.01"
                placeholder="Betrag als Einzahlung (CHF)"
                value={formData.allocateAmount}
                onChange={(e) => setFormData({ ...formData, allocateAmount: e.target.value })}
                disabled={!formData.savingsGoalId}
              />
              <p className="text-xs text-gray-500">
                Optional: Verbucht einen Betrag direkt auf das ausgewählte Sparziel.
              </p>
            </div>
          )}

          <div className={`flex ${isModal ? 'space-x-3' : 'justify-end'} pt-4`}>
            {isModal && (
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                className="flex-1"
                disabled={loading}
              >
                Abbrechen
              </Button>
            )}
            <Button type="submit" className={isModal ? 'flex-1' : ''} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Analysiere...
                </>
              ) : (
                'Transaktion erfassen'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
