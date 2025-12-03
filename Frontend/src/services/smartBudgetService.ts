export interface AnalyzePayload {
  amount: number;
  merchant: string;
  justification: string;
}

// Dein bisheriger Node Server läuft auf Port 3000
const API_BASE_URL = "http://localhost:3000";

export async function analyzePurchase(payload: AnalyzePayload) {
  const response = await fetch(`${API_BASE_URL}/api/analysePurchase`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    // dein alter Endpoint erwartet: amount, merchant, description
    body: JSON.stringify({
      amount: payload.amount,
      merchant: payload.merchant,
      description: payload.justification,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API Fehler: ${response.status} – ${text}`);
  }

  return response.json();
}
