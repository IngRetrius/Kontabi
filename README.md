# Kontabi

Kontabi is a multi-tenant financial management platform for residential communities in Colombia.

This project was built as a portfolio case to demonstrate practical financial accounting implementation in a real product context.

## Why This Project Exists

I built Kontabi to translate accounting fundamentals into software workflows that non-accountants can use confidently.

The implementation is directly inspired by concepts from the University of Virginia course Financial Accounting Fundamentals (Darden School of Business, taught by Luann J. Lynch), including:

- Journal entries to record transactions
- T-accounts to summarize activity by period
- Financial statement structure and relationships
- Balance Sheet, Income Statement, and Statement of Cash Flows logic
- Basic financial health analysis from recorded activity

## Portfolio Highlights

- Product-driven architecture with clear domain modules
- Full-stack implementation with Next.js and Supabase
- SQL migrations for schema evolution and governance
- Tenant-aware data model and access policies
- Financial workflows mapped to accounting cycle concepts

## Functional Scope Implemented

- Authentication: login and registration
- Onboarding flow with setup gate and progress checklist
- Units and owners management
- Transactions, journal, balance, and T-accounts views
- Budget creation, listing, and simulation
- Invoicing, overdue tracking, late interest, and payment registration
- Reconciliation flow with matching engine endpoint
- Compliance views for reserve fund, extraordinary fees, and assemblies
- Indicators and executive overview dashboard
- Reporting center and certification API routes
- Audit and period lock views
- Tenant settings for accounts, banks, financial rules, and structure

## Technology Stack

- Frontend: Next.js App Router, React, TypeScript
- UI: Tailwind CSS, shadcn/ui, lucide-react
- Animations: GSAP
- Backend and data: Supabase (PostgreSQL, Auth, Storage)
- Validation and forms: Zod, React Hook Form
- Charts and PDFs: Recharts, @react-pdf/renderer
- Quality: ESLint

## Project Structure

- src/app: routes and pages
- src/components: reusable and domain UI components
- src/lib: business logic and service integrations
- src/hooks: custom hooks
- src/types: shared TypeScript types
- supabase/migrations: database schema and policy migrations

## Getting Started

1. Install dependencies

```bash
npm install
```

2. Create .env.local in the project root

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

3. Apply SQL migrations from supabase/migrations in numeric order

4. Start development server

```bash
npm run dev
```

5. Open http://localhost:3000

## API Routes

- POST /api/cron/mark-overdue
- POST /api/reconciliation/match
- POST /api/reports/certification

## Current Status

- Stage: MVP in active development
- Focus: accounting correctness, modular architecture, and production-oriented data model
- Next: stronger automated testing and deployment hardening

## Author

Built by IngRetrius as a portfolio project to demonstrate accounting domain understanding, product design thinking, and full-stack engineering execution.
