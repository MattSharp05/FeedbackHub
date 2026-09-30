# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Build brief — Feedback Hub (for Claude Code)

This document is the handoff prompt. The repo is already scaffolded and builds
cleanly; use this to understand it, verify it, and extend it. If you are
regenerating from scratch, treat this as the spec and the existing files as the
source of truth for exact styling and copy.

## What this is

A UI prototype of a unified feedback dashboard for a portfolio of ~28 mobile
apps. Feedback arrives from three sources — App Store reviews, app emails, and
in-app chat — and is consolidated into one queue where each item is
auto-categorized, given a drafted reply, and either auto-sent or sent after
human approval. **Live data only — no mock data.** In-app chat is ingested from
the support-desk API (`src/data/supportDesk/`), App Store reviews from Apple's
public reviews feed (`src/data/appStore/`); Email is "coming soon" (`live:
false` in `SOURCES`). No AI classification/drafting yet, and **nothing is
really sent** — approve/send only changes local state.

## Non-negotiable architecture principle

**Source-specific at the edges, unified in the middle.** Each source has its own
ingestion and its own reply-delivery channel, but the queue, categorization,
drafting, approval, and reporting all operate on ONE normalized request record.
Every request carries a `source` field the whole way through, and that field
drives the delivery channel at send time. Do not split the app into three
per-source silos, and do not make source a top-level tab. Source is a
tag + filter + delivery router. App is the top-level organizing axis.

## Stack (already set up — keep it)

- Vite + React 19 + TypeScript
- Tailwind CSS v4 via `@tailwindcss/vite` (CSS-first config, NO
  `tailwind.config.js`, NO PostCSS config). Theme tokens live in
  `src/index.css` under `@theme`.
- `lucide-react` for icons
- Path alias `@/` → `src/` (configured in both `vite.config.ts` and the
  tsconfigs)

## Commands

```bash
npm install
npm run dev      # dev server
npm run build    # tsc -b && vite build — must pass with no errors
```

Always run `npm run build` after changes; it typechecks and builds. Keep it green.

## Data model (src/types.ts)

`FeedbackRequest` is the normalized record:
`id, app, source, category, lang, country, device, appVersion, screen, message,
draft, action, confidence, status, ageMin`.

- `source`: `"appstore" | "email" | "chat"`
- `category`: `cancel | refund | unsubscribe | billing | bug | feature | praise | other`
- `status`: `new | drafted | approved | sent | auto-handled`
- Trust mode per category: `draft | approve | auto`

Source metadata (`src/data/constants.ts` → `SOURCES`) carries the delivery
behavior: `sendLabel` (button text), `deliverVia` (destination description),
and `note` (e.g. App Store replies are public + one response per review).

## State & data flow

`App.tsx` is the single owner of all application state — there is no state
library, no context, no router. Everything is `useState` in `App` and passed
down as props; child components are presentational and mutate only through
callbacks. When adding features, follow this: lift state to `App`, derive with
`useMemo`, pass handlers down.

- **Source of truth:** `requests` (starts empty; each adapter in `INGESTION`
  appends its normalized rows on load, failures surface in a banner), plus `view`,
  `activeApp`, `openId`, `automation`, and the filter state (`query`,
  `catFilter`, `sourceFilter`).
- **The only mutation** is `act(id, status)` — it maps over `requests` to change
  one item's `status` and closes the drawer. All approve/reject/send actions in
  the Detail drawer funnel through this. There is no other way requests change.
- **Derived, not stored:** `filtered` (app + category + source + search, sorted
  by `ageMin`), `stats` (totals/needs/auto + per-category counts), and
  `pendingByApp` (sidebar badge counts) are all recomputed via `useMemo` from
  `requests`. Don't cache these in state.
- **Navigation** is `view` + `activeApp`, not URLs. Selecting an app sets
  `activeApp` and switches `view` to `queue`; the same `activeApp` drives the
  Queue filter. Insights/stat-card clicks are just setters passed as props.
- `automation` (the trust config) lives here too and is read by both the
  Automation screen (to edit) and the Detail drawer (to pick send behavior). See
  likely-next-task #1: send behavior should key off (category × source), and the
  plumbing already exists — `automation` is passed into `Detail`.

## Presentational primitives (`components/primitives.tsx`)

`Tile`, `CatTag`, `SourceBadge`, `StatusPill`, `Confidence` are the shared
data-display atoms — every screen renders requests through these, and each reads
its colors from `data/constants.ts` (`CATEGORIES`, `SOURCES`, `STATUS_META`,
`tileColor`). Reuse them rather than re-styling badges/tiles inline, and add new
per-datum visuals here so color logic stays in one place. `lib/format.ts` holds
tiny formatters like `ageLabel`.

## Screens (already implemented)

1. **Overview** (`components/Overview.tsx`) — landing view. Three stat cards
   (incoming / needs attention / auto-handled %), a "Needs attention" panel
   built from `INSIGHTS` that surfaces cross-app emerging issues, and a
   volume-by-category bar list. Clicking an insight opens that app's queue.

2. **Queue** (`components/Queue.tsx`) — app-first list. Selecting an app in the
   sidebar filters to it. A source-filter row (All sources / App Store / Email /
   In-app chat), a category-filter row, and search. Each row shows category,
   source badge, language/country, message snippet, status, confidence, age.

3. **Detail drawer** (`components/Detail.tsx`) — opens on row click. Original
   message + metadata, AI classification + confidence, a per-request action
   item, an editable drafted reply with its trust-mode badge, a "Delivered via
   ___" line (source-aware, with the App Store public/one-shot note), and a
   source-aware primary send button (e.g. "Approve & send email" vs "Approve &
   post response"). Approve / approve-only / reject mutate the item's status.

4. **Automations** (`components/Automation.tsx`) — per-category trust toggle:
   Draft only → Human approval → Auto-send. This is the phased trust model.
   Defaults: unsubscribe + praise on auto; refund + billing on approve; bug,
   feature, cancel, other on draft. (See `DEFAULT_AUTOMATION`.)

## Styling notes

- Notion-like: neutral warm-gray palette, generous whitespace, subtle 1px
  borders, calm and professional. Tokens are in `src/index.css`.
- Data-driven colors (category tones, source colors, app tile colors) are passed
  via inline `style`; layout/spacing uses Tailwind utility classes. This mix is
  intentional — keep it. Don't try to convert dynamic per-datum colors into
  Tailwind classes.
- App icons are deterministic colored letter-tiles (`tileColor` in constants),
  NOT the real app logos. Keep it that way.

## Guardrails when extending

- Keep `npm run build` passing (strict TS is on, including `noUnusedLocals` /
  `noUnusedParameters`).
- Preserve the "unified middle" — new features that touch categorize/draft/
  approve/report should work across all sources on the normalized record.
- Anything source-specific belongs at ingestion (parsing) or delivery (sending).
- Don't introduce browser storage; state is in-memory React state by design for
  this prototype.

## Likely next tasks (in priority order)

1. Extract the phased-rollout / trust model into shared logic so the Detail
   drawer's send behavior is derived from the Automation config per (category ×
   source) rather than category alone. Real-world: an email refund may auto-send
   but an App Store refund reply stays human-approved because it's public.
2. Add a thin data layer boundary (e.g. a `src/data/api.ts` with async functions
   returning the mock data) so swapping in a real backend later is a one-file
   change.
3. Ingestion adapters per source and a normalized DB schema (design the schema to
   match `FeedbackRequest`).
4. Reporting: turn the hard-coded `INSIGHTS` into something computed from the
   request set (cluster the "other" bucket, flag version-correlated bug spikes).
