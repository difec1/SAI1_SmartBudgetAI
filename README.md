# SmartBudgetAI

Ein KI-gestützter Finanzcoach: Transaktionen werden automatisch klassifiziert, Impulskäufe erkannt, Budgets aus Lohnzahlungen abgeleitet und Sparziele mit konkreten Regeln begleitet. Im Web-UI kannst du Transaktionen erfassen (manuell oder per CSV), den Verlauf filtern/sortieren, Budgets überwachen und Analysen nach Zeitraum einsehen.

## Tech-Stack und Wahl der Komponenten
- **Next.js 13 (App Router), TypeScript** – Schnelles Fullstack-React, klare Typisierung.
- **UI: Tailwind CSS, shadcn/ui + Radix** – Einheitliches Styling + zugängliche Primitives.
- **Supabase (PostgreSQL)** – Einfache Auth/DB-Anbindung, Realtime optional.
- **OpenAI** – KI-Klassifizierung; Mock-Modus für lokale Tests (`OPENAI_API_KEY=mock`).
- **Eigene Agents (lib/agents.ts)** – Kapseln Klassifizierung, Sparziele, Budgetlogik.

## Features
- KI-Klassifizierung inkl. Impulskauf-Erkennung.
- Budget aus Lohnhistorie (oder manuell) für Monat/Jahr/Custom-Zeitraum.
- Sparziele mit Regeln und Fortschritt.
- Verlauf mit Suche, Kategorie-/Typfilter, Datumsfilter, Sortierung, Vorzeichen-Anzeige.
- CSV-Import für Bulk-Transaktionen.

## Lokale Einrichtung
### Voraussetzungen
- Node.js 18+
- Supabase-Projekt (Service Role Key für serverseitige Writes)
- OpenAI API Key **oder** Mock (`OPENAI_API_KEY=mock`)

### 1) Env-Datei anlegen
```bash
cp .env.local.example .env.local
```
Pflichtwerte:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY` (oder `mock`)

### 2) Installieren
```bash
npm install
```

### 3) Dev-Server starten
```bash
npm run dev
```
App unter `http://localhost:3000` öffnen.

### 4) Demo-Daten seeden (optional)
```bash
curl -X POST http://localhost:3000/api/seed
```

## Wichtige Befehle
- Dev: `npm run dev`
- Lint: `npm run lint`
- Build: `npm run build`

## Projektstruktur (Auszug)
- `app/` – Pages/Routes (`/analyse`, `/verlauf`, `/eingabe`, API unter `app/api`)
- `lib/` – Agents (KI-Logik), Supabase-Client, Typen
- `components/` – UI-Komponenten (shadcn/ui)
- `supabase/` – SQL/Migrations (falls genutzt)

## Hinweis KI
- Mit `OPENAI_API_KEY=mock` liefert die App plausible Demo-Antworten ohne Kosten.
- Für Produktion: echten Key setzen, bei Bedarf Modell in `lib/openai.ts` anpassen.

