export interface AnalyzePayload {
  amount: number;
  merchant: string;
  justification: string;
}

const API_BASE_URL = "http://localhost:1337";

export async function analyzePurchase(payload: AnalyzePayload) {
  const response = await fetch(`${API_BASE_URL}/api/analyse-purchase`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: payload.amount,
      merchant: payload.merchant,
      justification: payload.justification,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API Fehler: ${response.status} – ${text}`);
  }

  return response.json();
}
