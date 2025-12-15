'use client';

import { useState, useEffect, useRef } from 'react';
import { Send, Loader2, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { SavingsGoal, ChatMessage } from '@/lib/types';
import { useI18n } from '@/hooks/useI18n';

export default function SparzieleChat() {
  const { t, lang } = useI18n();
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [ruleTranslations, setRuleTranslations] = useState<Record<string, string>>({});
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      role: 'assistant',
      content: t(
        'page.home.welcome',
        'Hallo! Ich bin dein persönlicher Finanzcoach. Ich helfe dir, deine Ausgaben zu analysieren und Sparziele zu erreichen. Was möchtest du heute besprechen?'
      ),
    },
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchGoals();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const translateRule = (rule: string, ruleEn?: string) => {
    if (lang !== 'en') return rule;
    if (ruleEn) return ruleEn;
    if (ruleTranslations[rule]) return ruleTranslations[rule];

    const monthlySavingsMatch = rule.match(/^Jeden Monat\s+([\d.,]+)\s*CHF aufs Sparkonto überweisen/i);
    if (monthlySavingsMatch) {
      return `Transfer ${monthlySavingsMatch[1]} CHF to savings each month`;
    }

    const eatOutMatch = rule.match(/^Essen gehen maximal\s+(\d+)x\s*(?:pro\s*)?(Woche|Monat)/i);
    if (eatOutMatch) {
      const unit = eatOutMatch[2].toLowerCase() === 'monat' ? 'month' : 'week';
      return `Eat out at most ${eatOutMatch[1]}x per ${unit}`;
    }

    const foodDeliveryMatch = rule.match(/^Food Delivery maximal\s+(\d+)x pro Woche/i);
    if (foodDeliveryMatch) {
      return `Food delivery at most ${foodDeliveryMatch[1]}x per week`;
    }

    const shoppingMatch = rule.match(/^Shopping maximal\s+([\d.,]+)\s*CHF pro Monat/i);
    if (shoppingMatch) {
      return `Shopping max ${shoppingMatch[1]} CHF per month`;
    }

    const cooldownMatch = rule.match(/^Vor jedem Kauf über\s+([\d.,]+)\s*CHF:\s*24h Bedenkzeit/i);
    if (cooldownMatch) {
      return `For every purchase over ${cooldownMatch[1]} CHF: 24h cooling-off period`;
    }

    return rule;
  };

  useEffect(() => {
    if (lang !== 'en' || goals.length === 0) return;
    const allRules = Array.from(new Set(goals.flatMap((g) => g.rules || [])));
    const missing = allRules.filter((r) => !ruleTranslations[r]);
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
        if (!res.ok) {
          throw new Error(`Translate request failed: ${res.status}`);
        }
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

  const fetchGoals = async () => {
    try {
      const response = await fetch('/api/goals');
      const data = await response.json();
      if (data.success) {
        setGoals(data.goals);
      }
    } catch (error) {
      console.error('Error fetching goals:', error);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || loading) return;

    const userMessage: ChatMessage = { role: 'user', content: inputMessage };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInputMessage('');
    setLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation: updatedMessages,
          userId: 'demoUser',
          lang,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setMessages([
          ...updatedMessages,
          { role: 'assistant', content: data.assistantMessage },
        ]);

        if (data.updatedGoals) {
          setGoals(data.updatedGoals);
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages([
        ...updatedMessages,
        { role: 'assistant', content: t('page.home.assistantError', 'Entschuldigung, da ist etwas schiefgelaufen.') },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="h-[calc(100vh-12rem)] flex flex-col">
            <CardHeader className="border-b">
              <CardTitle className="flex items-center space-x-2 text-gray-900 dark:text-gray-100">
                <Target className="w-6 h-6 text-blue-600" />
                <span>{t('page.home.title', 'Finanzcoach Chat')}</span>
              </CardTitle>
            </CardHeader>

            <CardContent className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-3 ${
                      message.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 rounded-lg px-4 py-3 flex items-center space-x-2">
                    <Loader2 className="w-4 h-4 animate-spin text-gray-600" />
                    <span className="text-gray-600">{t('analyse.loading', 'Analysiere...')}</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </CardContent>

            <div className="border-t p-4">
              <form onSubmit={handleSendMessage} className="flex space-x-2">
                <Input
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder={t('page.home.input.placeholder', 'Schreibe deine Nachricht...')}
                  disabled={loading}
                  className="flex-1"
                />
                <Button type="submit" disabled={loading || !inputMessage.trim()}>
                  <Send className="w-4 h-4" />
                  <span className="sr-only">{t('page.home.send', 'Senden')}</span>
                </Button>
              </form>
              <p className="text-xs text-gray-500 mt-2">
                {t(
                  'page.home.example',
                  'Beispiel: "Ich möchte 2000 CHF bis nächsten Sommer für Ferien sparen"'
                )}
              </p>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg text-gray-900 dark:text-gray-100">
                {t('goals.title', 'Deine Sparziele')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {goals.length === 0 ? (
                <p className="text-gray-500 text-sm">
                  {t('goals.empty', 'Du hast noch keine Sparziele. Erzähle dem Coach, was du sparen möchtest!')}
                </p>
              ) : (
                goals.map((goal) => {
                  const progress = (goal.currentSavedAmount / goal.targetAmount) * 100;
                  const daysUntil = Math.ceil(
                    (new Date(goal.targetDate).getTime() - new Date().getTime()) /
                      (1000 * 60 * 60 * 24)
                  );
                  const deadlineDate = new Date(goal.targetDate).toLocaleDateString(
                    lang === 'en' ? 'en-GB' : 'de-CH'
                  );
                  const daysLeftText =
                    lang === 'en'
                      ? `${daysUntil} days left`
                      : `${t('goals.daysLeft.prefix', 'Noch')} ${daysUntil} ${t('goals.daysLeft.suffix', 'Tage')}`;

                  return (
                    <div key={goal.id} className="space-y-3 p-4 bg-blue-50 dark:bg-gray-800 rounded-lg">
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">{goal.title}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          {goal.targetAmount} CHF{' '}
                          {lang === 'en' ? 'by' : t('goals.by', 'bis')} {deadlineDate}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{daysLeftText}</p>
                      </div>

                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600 dark:text-gray-300">
                            {t('goals.progress', 'Fortschritt')}
                          </span>
                          <span className="font-medium text-gray-900 dark:text-gray-100">
                            {goal.currentSavedAmount} CHF / {goal.targetAmount} CHF
                          </span>
                        </div>
                        <Progress value={progress} className="h-2" />
                      </div>

                      <div>
                        <p className="text-xs font-medium text-gray-700 dark:text-gray-200 mb-2">
                          {t('goals.rules', 'Deine Regeln:')}
                        </p>
                        <ul className="space-y-1">
                          {goal.rules.map((rule, idx) => (
                            <li key={idx} className="text-xs text-gray-600 dark:text-gray-200 flex items-start">
                              <span className="text-blue-600 dark:text-blue-300 mr-2">•</span>
                              <span>{translateRule(rule, goal.rulesEn?.[idx])}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
