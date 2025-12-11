'use client';

import { useState, useEffect, useRef } from 'react';
import { Send, Loader2, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { SavingsGoal, ChatMessage } from '@/lib/types';

export default function SparzieleChat() {
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        'Hallo! Ich bin dein persönlicher Finanzcoach. Ich helfe dir, deine Ausgaben zu analysieren und Sparziele zu erreichen. Was möchtest du heute besprechen?',
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
        { role: 'assistant', content: 'Entschuldigung, da ist etwas schiefgelaufen.' },
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
              <CardTitle className="flex items-center space-x-2">
                <Target className="w-6 h-6 text-blue-600" />
                <span>Finanzcoach Chat</span>
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
                        : 'bg-gray-100 text-gray-900'
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
                    <span className="text-gray-600">Analysiere...</span>
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
                  placeholder="Schreibe deine Nachricht..."
                  disabled={loading}
                  className="flex-1"
                />
                <Button type="submit" disabled={loading || !inputMessage.trim()}>
                  <Send className="w-4 h-4" />
                </Button>
              </form>
              <p className="text-xs text-gray-500 mt-2">
                Beispiel: &quot;Ich möchte 2000 CHF bis nächsten Sommer für Ferien sparen&quot;
              </p>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Deine Sparziele</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {goals.length === 0 ? (
                <p className="text-gray-500 text-sm">
                  Du hast noch keine Sparziele. Erzähle dem Coach, was du sparen möchtest!
                </p>
              ) : (
                goals.map((goal) => {
                  const progress = (goal.currentSavedAmount / goal.targetAmount) * 100;
                  const daysUntil = Math.ceil(
                    (new Date(goal.targetDate).getTime() - new Date().getTime()) /
                      (1000 * 60 * 60 * 24)
                  );

                  return (
                    <div key={goal.id} className="space-y-3 p-4 bg-blue-50 rounded-lg">
                      <div>
                        <h3 className="font-semibold text-gray-900">{goal.title}</h3>
                        <p className="text-sm text-gray-600">
                          {goal.targetAmount} CHF bis {new Date(goal.targetDate).toLocaleDateString('de-CH')}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Noch {daysUntil} Tage
                        </p>
                      </div>

                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600">Fortschritt</span>
                          <span className="font-medium">
                            {goal.currentSavedAmount} CHF / {goal.targetAmount} CHF
                          </span>
                        </div>
                        <Progress value={progress} className="h-2" />
                      </div>

                      <div>
                        <p className="text-xs font-medium text-gray-700 mb-2">Deine Regeln:</p>
                        <ul className="space-y-1">
                          {goal.rules.map((rule, idx) => (
                            <li key={idx} className="text-xs text-gray-600 flex items-start">
                              <span className="text-blue-600 mr-2">•</span>
                              <span>{rule}</span>
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
