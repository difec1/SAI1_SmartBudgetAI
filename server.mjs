import express from "express";
import cors from "cors";
import OpenAI from "openai";
import "dotenv/config";

const app = express();
app.use(cors());
app.use(express.json());

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 1. Analyse Endpunkt
app.post("/api/analysePurchase", async (req, res) => {
  try {
    const { amount, merchant, description } = req.body;

    if (typeof amount !== "number" || !merchant || !description) {
      return res
        .status(400)
        .json({ error: "Bitte Betrag, Händler und Beschreibung senden." });
    }

    const userInput = `
Analysiere folgenden Online Einkauf:

Betrag: ${amount.toFixed(2)} CHF
Händler / Shop: ${merchant}
Artikel / Beschreibung: ${description}

Aufgabe:
1. Ordne den Einkauf einer sinnvollen Budget Kategorie zu (z. B. Wohnen, Mobilität, Essen, Freizeit, Elektronik, Kleidung, Abos, Gesundheit, Haushalt, Sonstiges).
2. Entscheide, ob der Einkauf eher eine normale, geplante Ausgabe oder ein möglicher Impulskauf ist.
3. Begründe deine Einschätzung kurz mit Bezug auf Betrag, Art des Artikels, Händler und typisches Konsumverhalten.
4. Gib zwei konkrete, alltagsnahe Budget Tipps, die zu diesem Einkauf passen.
5. Triff am Schluss eine klare Entscheidung:
   - Verwende das Wort PUSH_NEEDED, wenn du eine Push Benachrichtigung empfehlen würdest.
   - Verwende das Wort NO_PUSH, wenn keine Push Benachrichtigung nötig ist.
`;

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      instructions: `
Du bist SmartBudgetAI, ein konsequenter Budget Coach für Privatpersonen in der Schweiz.
Du bist freundlich, aber klar und eher streng.

Grundhaltung:
- Nur notwendige Alltagskosten sind klar unkritisch.
- Teure Elektronik, zusätzliche Fahrzeuge, Sneaker und Modekäufe sind potentiell Impulskäufe und sollen kritisch bewertet werden.
- Wenn du unsicher bist, entscheide dich für PUSH_NEEDED.

Format:
- 1 bis 3 kurze Sätze zur Einordnung des Einkaufs.
- 1 bis 2 Sätze zur Einschätzung (normal vs eher impulsiv).
- 2 konkrete Budget Tipps als nummerierte Liste.
- Am Ende in einer neuen Zeile nur PUSH_NEEDED oder NO_PUSH.

Schreibe alles auf Deutsch in einfacher Alltagssprache.
      `,
      input: userInput,
    });

    const fullText = response.output_text || "";

    let decision = "NO_PUSH";
    if (/PUSH_NEEDED/.test(fullText)) decision = "PUSH_NEEDED";
    if (/NO_PUSH/.test(fullText)) decision = "NO_PUSH";

    const cleanedText = fullText
      .replace(/PUSH_NEEDED/g, "")
      .replace(/NO_PUSH/g, "")
      .trim();

    console.log("Analyse OK:", {
      amount,
      merchant,
      decision,
    });

    return res.json({
      aiText: cleanedText,
      decision,
    });
  } catch (err) {
    console.error("Fehler in /api/analysePurchase:", err);
    return res.status(500).json({ error: "Fehler bei der Analyse im Server." });
  }
});

// 2. Begründungs Endpunkt
app.post("/api/justifyPurchase", async (req, res) => {
  try {
    const { amount, merchant, description, justification } = req.body;

    if (
      typeof amount !== "number" ||
      !merchant ||
      !description ||
      !justification
    ) {
      return res.status(400).json({
        error:
          "Betrag, Händler, Beschreibung und Begründung sind für die Prüfung nötig.",
      });
    }

    const input = `
Einkauf:

Betrag: ${amount.toFixed(2)} CHF
Händler / Shop: ${merchant}
Artikel / Beschreibung: ${description}

Begründung des Nutzers:
"${justification}"

Aufgabe:
1. Prüfe, ob die Begründung plausibel und verantwortungsvoll ist
   (z. B. notwendiger Ersatz, Arbeitsbedarf, Gesundheit, Sicherheit, seit längerem geplanter Kauf).
2. Prüfe, ob die Begründung eher impulsiv oder rein emotional wirkt.
3. Triff eine klare Entscheidung:
   - APPROVE_TRANSACTION, wenn die Begründung plausibel und verantwortungsvoll ist.
   - ABORT_TRANSACTION, wenn die Begründung nicht plausibel oder eher impulsiv wirkt.
4. Erkläre deine Entscheidung in 2 bis 4 Sätzen in einfacher Sprache.
5. Am Ende in einer neuen Zeile nur APPROVE_TRANSACTION oder ABORT_TRANSACTION.

Wenn du unsicher bist, entscheide dich für ABORT_TRANSACTION.
`;

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      instructions: `
Du bist ein strenger, aber fairer Finanzcoach.
Dein Ziel ist, den Nutzer vor unüberlegten Online Käufen zu schützen.
Nur wenn die Begründung klar und vernünftig ist, gibst du den Kauf frei.

Format:
- Kurze Erklärung in Deutsch.
- Am Schluss in einer eigenen Zeile nur APPROVE_TRANSACTION oder ABORT_TRANSACTION.
      `,
      input,
    });

    const fullText = response.output_text || "";

    let finalDecision = "ABORT_TRANSACTION";
    if (/APPROVE_TRANSACTION/.test(fullText))
      finalDecision = "APPROVE_TRANSACTION";
    if (/ABORT_TRANSACTION/.test(fullText)) finalDecision = "ABORT_TRANSACTION";

    const explanation = fullText
      .replace(/APPROVE_TRANSACTION/g, "")
      .replace(/ABORT_TRANSACTION/g, "")
      .trim();

    console.log("Justify OK:", {
      amount,
      merchant,
      finalDecision,
    });

    return res.json({
      explanation,
      finalDecision,
    });
  } catch (err) {
    console.error("Fehler in /api/justifyPurchase:", err);
    return res.status(500).json({
      error: "Fehler bei der Begründungsprüfung im Server.",
    });
  }
});

const port = 3000;
app.listen(port, () => {
  console.log(`SmartBudgetAI API läuft auf http://localhost:${port}`);
});
