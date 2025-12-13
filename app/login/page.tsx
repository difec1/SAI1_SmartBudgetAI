'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { useAuth } from '@/hooks/useAuth';

export default function LoginPage() {
  const router = useRouter();
  const { session } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session) {
      router.replace('/');
    }
  }, [session, router]);

  const handleAuth = async (mode: 'login' | 'signup') => {
    setLoading(true);
    setError(null);
    try {
      const fn =
        mode === 'login'
          ? supabaseBrowser.auth.signInWithPassword
          : supabaseBrowser.auth.signUp;
      const { data, error } = await fn({ email, password });
      if (error) {
        setError(error.message);
        return;
      }
      const token = data.session?.access_token;
      if (token) {
        // simple cookie for middleware route guarding
        document.cookie = `sb-access-token=${token}; path=/; max-age=604800; SameSite=Lax`;
      }
      router.replace('/');
    } catch (err: any) {
      setError(err?.message || 'Fehler beim Anmelden');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="text-xl text-gray-900">Anmelden</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm text-gray-700">E-Mail</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-gray-700">Passwort</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex space-x-2">
            <Button
              className="flex-1"
              onClick={() => handleAuth('login')}
              disabled={loading}
            >
              {loading ? 'Lade...' : 'Login'}
            </Button>
            <Button
              className="flex-1"
              variant="outline"
              onClick={() => handleAuth('signup')}
              disabled={loading}
            >
              Registrieren
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
