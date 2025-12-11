# SmartBudgetAI

Ein intelligenter persönlicher Finanzcoach mit KI-gestützter Ausgabenanalyse, Impulskauferkennung und Sparzielverwaltung.

## Projektziel

SmartBudgetAI hilft Nutzern dabei, ihre Finanzen besser zu verstehen und zu kontrollieren durch:

1. **Intelligente Chat-Interaktion**: Ein KI-Coach, der in natürlicher Sprache über Geld, Sparziele und Ausgabenverhalten spricht
2. **Automatische Transaktionsanalyse**: KI-gestützte Kategorisierung und Bewertung jeder Ausgabe
3. **Impulskauferkennung**: Identifizierung von spontanen, emotionalen Käufen
4. **Sparzielverwaltung**: Extraktion von Sparzielen aus natürlicher Sprache und Generierung konkreter Verhaltensregeln
5. **Muster-Erkennung**: Analyse von Ausgabegewohnheiten (z.B. teuerster Wochentag, Zeitpunkt von Impulskäufen)

## Technologie-Stack

- **Frontend**: Next.js 13 mit TypeScript, React, Tailwind CSS
- **Backend**: Next.js API Routes
- **Datenbank**: Supabase (PostgreSQL)
- **KI**: OpenAI GPT-4o-mini
- **UI-Komponenten**: shadcn/ui mit Radix UI

## Architektur

### Agent-Architektur

Die Kernlogik ist in vier modulare Agents organisiert (siehe `lib/agents.ts`):

#### 1. DataExtractionAgent
Konvertiert Rohdaten (Formular-Input) in strukturierte Transaction-Objekte.

**Input**: `{ date, merchant, amount, rawCategory?, justification? }`
**Output**: Strukturiertes Transaction-Objekt (ohne KI-Klassifizierung)

#### 2. ImpulseClassificationAgent
Nutzt OpenAI mit Few-Shot Learning (basierend auf Kaggle-Daten) zur Klassifizierung.

**Input**: Unklassifizierte Transaction
**Output**:
- `category` (Shopping, Food Delivery, Transport, etc.)
- `isImpulse` (boolean)
- `decisionLabel` ("useful" oder "unnecessary")
- `decisionExplanation` (deutsche Erklärung)

#### 3. SavingsGoalAgent
Extrahiert Sparziele aus natürlicher Sprache und generiert Verhaltensregeln.

**Input**: Natürlichsprachige Nachricht wie "Ich möchte 2000 CHF bis nächsten Sommer sparen"
**Output**:
- `goalTitle` (z.B. "Sommer Ferien")
- `targetAmount` (2000)
- `targetDate` (ISO-Datum)
- `rules` (3-4 konkrete Verhaltensregeln)

#### 4. BudgetPlannerAgent
Analysiert Transaktionen und generiert Budget-Insights.

**Input**: Monatseinkommen, Transaktionsliste, Monat
**Output**:
- `monthlyBudget` (60% des Nettoeinkommens)
- `usedBudget`
- `byCategory` (Ausgaben pro Kategorie)
- `patterns` (Erkannte Muster und Nudges)

### Kaggle Dataset Integration

Die Datei `lib/kaggleData.ts` verwaltet historische Transaktionsdaten:

1. **Few-Shot Examples**: Repräsentative Beispiele für jede Kategorie werden dem ImpulseClassificationAgent als Kontext übergeben
2. **Baseline-Statistiken**: Durchschnittswerte für Kategorien und Impulskauf-Raten als Vergleichsbasis

**Für Produktion**: Die Funktion `loadKaggleDataFromCSV()` kann aktiviert werden, um echte CSV-Daten aus dem `/data`-Ordner zu laden.

## API Routen

### `POST /api/chat`
Chat-Interaktion mit dem Finanzcoach. Erkennt automatisch Sparziel-Intents und ruft den SavingsGoalAgent auf.

### `POST /api/transactions`
Erstellt eine neue Transaktion. Durchläuft DataExtractionAgent und ImpulseClassificationAgent.

### `GET /api/transactions`
Gibt alle Transaktionen des Demo-Users zurück.

### `GET /api/analysis`
Generiert Budget-Analyse mit BudgetPlannerAgent. Liefert:
- BudgetSummary
- Impulskäufe
- Sparziele
- Erkannte Muster

### `GET /api/goals`
Gibt alle Sparziele zurück.

### `POST /api/seed`
Seeded Demo-Daten (User, Transaktionen, Sparziele) für MVP-Tests.

## Seiten

### 1. Sparziele (`/`)
Chat-Interface mit dem KI-Finanzcoach. Sidebar zeigt aktive Sparziele mit Fortschrittsbalken.

### 2. Analyse (`/analyse`)
- Budget-Übersicht (Balken)
- Ausgaben nach Kategorie (Cards mit Icons)
- Erkannte Impulskäufe
- Sparplan mit Verhaltensregeln
- Erkannte Muster & Nudges

### 3. Verlauf (`/verlauf`)
Liste aller Transaktionen mit:
- Merchant, Datum, Kategorie
- KI-Erklärung
- Farbliche Markierung (grün = sinnvoll, rot = unnötig)
- Button "Neue Transaktion"

## Setup und Installation

### 1. Supabase Datenbank einrichten

Die Migrations sind bereits angelegt. Die Datenbank-Tabellen werden automatisch erstellt:
- `users`: Nutzer-Stammdaten
- `transactions`: Alle Transaktionen mit KI-Klassifizierung
- `savings_goals`: Sparziele mit Verhaltensregeln

### 2. Umgebungsvariablen

Kopiere `.env.local.example` zu `.env.local` und fülle die Werte aus:

```bash
cp .env.local.example .env.local
```

Erforderliche Variablen:
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase Projekt-URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase Anon Key
- `SUPABASE_SERVICE_ROLE_KEY`: Service Role Key (server-seitig genutzt, um RLS-Regeln für Inserts/Selects im MVP zu umgehen)
- `OPENAI_API_KEY`: OpenAI API Key (oder "mock" für Demo-Modus)

### 3. Abhängigkeiten installieren

```bash
npm install
```

### 4. Demo-Daten laden

Starte die Entwicklungsumgebung und rufe dann den Seed-Endpoint auf:

```bash
npm run dev
```

Dann in einem neuen Terminal:

```bash
curl -X POST http://localhost:3000/api/seed
```

Oder öffne im Browser: `http://localhost:3000/api/seed` (POST-Request)

### 5. App öffnen

Öffne `http://localhost:3000` im Browser.

## Demo-Workflow

1. **Sparziele-Tab**: Chatte mit dem Coach und setze ein Sparziel (z.B. "Ich möchte 3000 CHF für ein neues Auto in 12 Monaten sparen")
2. **Verlauf-Tab**: Klicke auf "Neue Transaktion" und füge eine Ausgabe hinzu (z.B. Zalando, 150 CHF)
3. **Analyse-Tab**: Sieh dir die Budget-Übersicht, Impulskäufe und erkannte Muster an

## Architektur für zukünftige Migration

### Zu Strapi Backend
Die aktuellen Supabase-Funktionen in `lib/supabase.ts` würden durch Strapi API-Calls ersetzt:
- `getUser()` → `GET /api/users/:id`
- `createTransaction()` → `POST /api/transactions`
- etc.

Die Agents in `lib/agents.ts` würden als Strapi Plugins oder Services implementiert.

### Zu Vue Frontend
Die React-Komponenten würden als Vue 3 Components umgeschrieben, die dieselben API-Routen nutzen.

## Entwicklungshinweise

### OpenAI API
Für MVP-Tests kann `OPENAI_API_KEY=mock` gesetzt werden. Die Mock-Implementierung in `lib/openai.ts` liefert plausible Demo-Antworten.

Für Produktion: Einen echten OpenAI API Key verwenden.

### Kaggle Dataset
Aktuell verwendet die App synthetische Daten. Für Produktion:
1. Kaggle-CSV in `/data/transactions.csv` ablegen
2. In `lib/kaggleData.ts` die Funktion `loadKaggleDataFromCSV()` aktivieren

### Code-Kommentare
Im Code finden sich Hinweise wie:
- `// In der Zukunft würde Strapi...`
- `// TODO: In Produktion CSV laden`

Diese markieren Stellen für zukünftige Backend-Migration.

## Weitere Features (Ideen für v2)

- Multi-User Support (aktuell nur "demoUser")
- Authentifizierung mit Supabase Auth
- Export-Funktion für Transaktionen (CSV, PDF)
- Budget-Alerting (Email/Push wenn Budget > 80%)
- Vergleich mit anderen Nutzern (anonymisiert)
- Mobile App (React Native)
- Verknüpfung mit Bank-APIs (Open Banking)

## Troubleshooting

### Build Error with Progress Component

If you encounter a build error related to the Progress component, this is a known issue with the combination of Next.js 13.5.1 and Radix UI libraries during production builds. The code is correct but there's a minification issue.

**Workaround**: Use development mode which works perfectly:
```bash
npm run dev
```

For production deployment, consider upgrading to Next.js 14+ or use the development mode with appropriate environment configurations.

## Lizenz

MIT

## Kontakt

Entwickelt als MVP-Prototyp für SmartBudgetAI.
