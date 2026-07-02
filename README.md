# Feedback Hub

A unified dashboard prototype for consolidating user feedback across a portfolio
of mobile apps. Feedback from three sources (App Store reviews, app emails, and
in-app chat) lands in one place where it is auto-categorized, given a drafted
reply, and either auto-sent or routed through human approval.

> **Status:** UI prototype with mock data. There is no backend yet — sources and
> a database are planned as the next phase. Nothing is actually sent anywhere;
> the "AI" outputs are pre-filled to demonstrate the flow.

## Architecture principle

**Source-specific at the edges, unified in the middle.** Each source has its own
ingestion parsing and its own reply/delivery channel, but everything in between
(the queue, categorization, drafting, approval, reporting) operates on one
normalized request record. The `source` field is carried through the whole
pipeline and drives which delivery channel a reply goes to.

## Stack

- **Vite** + **React 19** + **TypeScript**
- **Tailwind CSS v4** (via `@tailwindcss/vite`, CSS-first config — no
  `tailwind.config.js`)
- **lucide-react** for icons

## Getting started

```bash
npm install
npm run dev
```

Then open the URL Vite prints (default http://localhost:5173).

Other scripts:

```bash
npm run build     # typecheck + production build
npm run preview   # preview the production build
```

## Project structure

```
src/
  App.tsx                 # top-level state + layout wiring
  main.tsx                # React entry
  index.css               # Tailwind import + theme tokens
  types.ts                # shared TypeScript types
  data/
    constants.ts          # sources, categories, statuses, apps, defaults
    requests.ts           # mock feedback requests + overview insights
  lib/
    format.ts             # small formatting helpers
  components/
    Sidebar.tsx           # left rail: nav + app list
    Overview.tsx          # landing page: stats, insights, volume
    Queue.tsx             # request list with source/category/search filters
    Detail.tsx            # request drawer: draft, action item, delivery, actions
    Automation.tsx        # per-category trust-mode toggles
    primitives.tsx        # Tile, CatTag, SourceBadge, StatusPill, Confidence
```

## Feature overview

- **Overview** — totals, a "needs attention" panel that surfaces emerging issues
  across apps, and volume by category.
- **Queue** — app-first (select an app in the rail), with source and category
  filters plus search. Source is a tag/filter, not a separate silo.
- **Detail drawer** — original message + metadata, AI classification with a
  confidence score, a per-request action item, an editable drafted reply, and a
  source-aware send action. A "Delivered via ___" line shows which channel the
  reply is routed to (App Store responses are flagged as public + one-shot).
- **Automations** — a per-category trust model: `Draft only` → `Human approval`
  → `Auto-send`. This is the phased rollout: start human-gated, graduate
  low-risk categories to auto-send, keep refunds/billing human-gated.

## Next phase (not yet built)

- Real ingestion adapters per source (App Store Connect API, email/IMAP or
  helpdesk, the in-app chat pipeline that currently posts to Slack).
- A database for the normalized request records.
- Real classification + reply drafting grounded in the knowledge base.
- Delivery adapters per source to actually send approved replies.
```
