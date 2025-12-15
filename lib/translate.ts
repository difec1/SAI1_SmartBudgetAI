import { callOpenAI } from './openai';

export async function translateTexts(texts: string[], targetLang: 'EN' | 'DE') {
  if (!texts.length) return [];
  // OpenAI-only translation to avoid external API quotas
  const systemPrompt = `You are a translator. Translate user text into ${targetLang}. Return only the translation.`;
  const results: string[] = [];
  for (const text of texts) {
    try {
      const translated = await callOpenAI(systemPrompt, text, 0);
      results.push(translated?.trim() || text);
    } catch (err) {
      console.error('OpenAI translation failed:', err);
      results.push(text);
    }
  }
  return results;
}

/**
 * Translate a single text to English with a fallback to OpenAI if DeepL fails
 * or returns the unchanged source string.
 */
export async function translateToEnglish(text: string): Promise<string> {
  if (!text) return text;
  try {
    const systemPrompt = 'You are a translator. Translate the user text to English. Return only the translation.';
    const translated = await callOpenAI(systemPrompt, text, 0);
    if (translated?.trim()) return translated.trim();
  } catch (err) {
    console.error('OpenAI translation fallback failed:', err);
  }
  return text;
}
