import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default {
  async analysePurchase(ctx) {
    try {
      const { amount, merchant, justification } = ctx.request.body;

      if (!amount || !merchant || !justification) {
        ctx.status = 400;
        ctx.body = { error: "Bitte alle Felder ausfüllen." };
        return;
      }

      const prompt = `
Bewerte folgenden geplanten Einkauf:

Betrag: ${amount} CHF
Händler: ${merchant}
Begründung: "${justification}"

Gib ein JSON zurück mit:
{
  "decision": "APPROVE_TRANSACTION" oder "ABORT_TRANSACTION",
  "explanation": "Kurze verständliche Erklärung"
}
`;

      // Neue OpenAI Responses API (korrekt typisiert)
      const response = await client.responses.create({
        model: "gpt-4.1-mini",
        input: prompt,
      });

      // Dadurch wird es stabil:
      const textOutput = response.output_text;

      let parsed;
      try {
        parsed = JSON.parse(textOutput);
      } catch {
        parsed = {
          decision: "APPROVE_TRANSACTION",
          explanation:
            "Die KI konnte keine klare Entscheidung treffen. Daher wird der Kauf als akzeptabel eingestuft.",
        };
      }

      ctx.body = {
        amount,
        merchant,
        justification,
        decision: parsed.decision,
        explanation: parsed.explanation,
      };
    } catch (err) {
      console.error("Fehler in analysePurchase:", err);
      ctx.status = 500;
      ctx.body = { error: "Serverfehler bei der Analyse." };
    }
  },
};
