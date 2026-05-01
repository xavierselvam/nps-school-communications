# NPS School Communications

A parent-facing web app for staying on top of school communications from NPS International School (npsis.edu.sg).

## Features

- 📬 **Gmail Inbox** — Reads emails from @npsis.edu.sg domain
- 📱 **Mobile-friendly UI** — Optimized for phones
- ✅ **Smart Task Extraction** — Rule-based extraction of action items (no AI/LLM)
- 🔔 **Unread indicators** — Visual unread state
- 🏷️ **Filter by "Needs Action"** — Surface emails with extracted tasks
- 📋 **Tasks view** — See all open/done tasks with due dates

## Tech Stack

- **Framework**: Next.js 14 (App Router) + TypeScript
- **Styling**: Tailwind CSS
- **Database**: PostgreSQL via Docker + Prisma ORM
- **Auth**: NextAuth.js with Google OAuth2
- **Email**: Gmail API (read-only)

## Prerequisites

- Node.js 18+
- Docker & Docker Compose
- Google Cloud project with Gmail API enabled

## Setup

### 1. Clone and install dependencies

```bash
git clone <repo-url>
cd nps-school-communications
npm install
```

### 2. Set up Google OAuth credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or use existing)
3. Enable the **Gmail API**
4. Go to **APIs & Services > Credentials**
5. Create an **OAuth 2.0 Client ID** (Web application)
6. Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
7. Copy the Client ID and Client Secret

### 3. Configure environment variables

Copy `.env.example` to `.env` and fill in values:

```bash
cp .env.example .env
```

Edit `.env`:
```
DATABASE_URL="postgresql://nps:nps_password@localhost:5432/nps_communications"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="<generate with: openssl rand -base64 32>"
GOOGLE_CLIENT_ID="<your-google-client-id>"
GOOGLE_CLIENT_SECRET="<your-google-client-secret>"
```

### 4. Start the database

```bash
docker-compose up -d
```

### 5. Run database migrations

```bash
npx prisma migrate dev --name init
```

### 6. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Usage

1. **Sign in** with your Google account
2. Click **"Sync Now"** to fetch emails from @npsis.edu.sg
3. Browse your **Inbox** — unread emails are highlighted
4. Tap an email to see the **detail view** with extracted action items
5. Use **"Needs Action"** filter to see only emails with tasks
6. Visit **Tasks** page to see all extracted action items with due dates

## How Task Extraction Works

Tasks are extracted using rule-based pattern matching — no AI required:

- Detects action keywords: `pay`, `submit`, `sign`, `consent form`, `register`, `deadline`, etc.
- Extracts due dates from: ISO dates, DD/MM/YYYY, "15 January", "next Friday", "tomorrow", etc.
- Limits to 5 tasks per email to avoid noise
- Deduplicates similar sentences

## Project Structure

```
app/
├── page.tsx              # Landing / sign-in page
├── layout.tsx            # Root layout with providers
├── providers.tsx         # NextAuth SessionProvider
├── inbox/
│   ├── page.tsx          # Inbox list view
│   └── [id]/page.tsx     # Email detail view
├── tasks/
│   └── page.tsx          # Tasks list view
└── api/
    ├── auth/[...nextauth]/route.ts
    ├── sync/route.ts
    ├── emails/route.ts
    ├── emails/[id]/route.ts
    ├── tasks/route.ts
    └── tasks/[id]/route.ts

lib/
├── prisma.ts             # Prisma client singleton
├── gmail.ts              # Gmail API sync logic
└── taskExtractor.ts      # Rule-based task extraction

prisma/
└── schema.prisma         # Database schema
```

## Running in Production

1. Set `NEXTAUTH_URL` to your production URL
2. Use a managed PostgreSQL service and update `DATABASE_URL`
3. Run `npx prisma migrate deploy`
4. Build: `npm run build`
5. Start: `npm start`
