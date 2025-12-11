# Quick Setup Guide

Follow these steps to get SmartBudgetAI up and running:

## Prerequisites

- Node.js 18+ installed
- A Supabase account (free tier works great)
- Optional: OpenAI API key (can use mock mode without it)

## Step-by-Step Setup

### 1. Configure Environment Variables

Create a `.env.local` file in the project root:

```bash
# Supabase Configuration (required)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# OpenAI Configuration (optional for MVP)
# Use 'mock' for demo mode, or your real API key for production
OPENAI_API_KEY=mock
```

**Getting Supabase Credentials:**
1. Go to [https://supabase.com](https://supabase.com)
2. Create a new project (or use existing one)
3. Go to Settings → API
4. Copy the "Project URL" and "anon public" key

### 2. Install Dependencies

```bash
npm install
```

### 3. Database is Ready

The database migrations have already been applied when you created your Supabase project. The following tables are ready:
- `users` - User profiles
- `transactions` - All transactions with AI classification
- `savings_goals` - User savings goals with rules

### 4. Seed Demo Data

Start the development server:

```bash
npm run dev
```

Then in another terminal, seed the demo data:

```bash
curl -X POST http://localhost:3000/api/seed
```

Or visit `http://localhost:3000/api/seed` in your browser.

This creates:
- A demo user ("demoUser")
- 7 sample transactions (Coop, Zalando, SBB, Uber Eats, etc.)
- 1 sample savings goal ("Thailand Ferien")

### 5. Open the App

Visit [http://localhost:3000](http://localhost:3000)

You should see the **Sparziele (Goals)** page with the chat interface ready to use!

## Quick Test Workflow

1. **Chat Tab** (`/`): Try chatting with the AI coach
   - Example: "Ich möchte 3000 CHF für ein neues Auto in 12 Monaten sparen"

2. **Verlauf Tab** (`/verlauf`): View existing transactions and add a new one
   - Click "Neue Transaktion"
   - Add: Merchant "Zalando", Amount "150"
   - Watch the AI classify it!

3. **Analyse Tab** (`/analyse`): See budget overview, impulse purchases, and patterns

## Common Issues

### Error: Missing Environment Variables
Make sure `.env.local` exists with valid Supabase credentials.

### Error: Cannot connect to Supabase
Check that your Supabase URL and anon key are correct.

### Empty Pages
Run the seed script to populate demo data.

### OpenAI Responses Look Generic
You're in mock mode. This is fine for testing! To use real AI:
1. Get an OpenAI API key from [https://platform.openai.com](https://platform.openai.com)
2. Set `OPENAI_API_KEY=sk-your-actual-key` in `.env.local`
3. Restart the dev server

## Next Steps

- Explore the codebase starting with `lib/agents.ts`
- Check out the README.md for detailed architecture documentation
- Try adding more transactions and see the AI analysis improve
- Modify the budget planner rules in `lib/agents.ts`

Happy budgeting! 💰
