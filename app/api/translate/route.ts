import { NextRequest, NextResponse } from 'next/server';
import { translateTexts } from '@/lib/translate';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { texts, targetLang } = body || {};

    if (!Array.isArray(texts) || !texts.every((t) => typeof t === 'string')) {
      return NextResponse.json({ success: false, error: 'Invalid texts payload' }, { status: 400 });
    }

    const lang = typeof targetLang === 'string' && targetLang.toUpperCase() === 'EN' ? 'EN' : 'DE';
    const translations = await translateTexts(texts, lang);

    return NextResponse.json({ success: true, translations });
  } catch (error: any) {
    console.error('Error translating text via DeepL:', error);
    const message =
      error instanceof Error ? error.message : 'Translation failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
