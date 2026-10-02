# Almaza Deck System

A V1 Yu-Gi-Oh deck management web app built with Next.js, React, Prisma, and SQLite.

## Local Setup

Use Node.js 22 and pnpm 11.19.0. For Vercel + Neon and automatic GitHub Actions
deployment on pushes to `main`, follow [DEPLOYMENT.md](DEPLOYMENT.md).

```bash
pnpm install
cp .env.example .env
pnpm setup
pnpm dev
```

Open `http://localhost:3000`.

Seeded admin account:

- Username: `admin`
- Password: `admin@123`

## Features

- Username/password signup and login
- Public deck viewing for every user
- Owner-only editing, plus one admin role that can edit any deck
- Admin deck is hidden from public deck browsing
- Admin user deletion from the public deck list
- Main Deck, Fusion Deck, Extra Cards, and Side Deck per user
- Debounced live YGOPRODeck search integration
- Saved card sets in the search section, starting with Joy Card Set
- Saved sets import into Extra Cards for manual sorting
- Admins can edit saved card sets from the deck search panel
- Preserved card details: image, name, ATK, DEF, level, type, and description
- Maximum 3 copies across Main, Fusion, and Side Deck sections
- Fusion monsters can only be placed in the Fusion Deck or Extra Cards
- Only Fusion monsters can be placed in the Fusion Deck
- Extra Cards can hold additional physical copies
- Bulk multi-select, shift-range selection, select all, move, and remove actions
- Drag one card copy between sections on pointer devices
- Drag cards directly from search results into deck sections
- Responsive desktop/tablet/mobile layout with mobile tabs

## Arabic Card Text

The language switcher also changes card names, types, and effects in search, saved sets,
deck lists, and the rendered card details. English names and IDs are retained internally
for card rules, images, and imports. Arabic search matches bundled, cached, and admin-edited names.

`src/lib/arabicCardText.ts` supplies Arabic names for both starter sets and common effects.
Other text is machine-translated on demand through Google's public translation endpoint
and cached by the exact English source in `data/translations/ar/`. This endpoint is
unofficial and has no availability guarantee. On failure the original text remains visible
with a retry action. Changing the English effect requests a new translation.

Admins can supply an Arabic name and effect in Card Details and save them with the
existing card data action. These corrections take priority over automatic translation and
are stored in `data/power-of-chaos-kaiba-cards.json`. Keep that file and the translation
directory with your database backups. No private user data is sent for translation.
