# Trackpaw — AI Assistant Guide

## What is Trackpaw?

Trackpaw is a self-hosted, privacy-first analytics platform distributed as npm packages. Users install it in their own projects to track events, analyze funnels/retention, and view dashboards — all without sending data to third parties.

## Installing Trackpaw in a user's project

Run the CLI to set up everything automatically:

```bash
npx @trackpaw/cli init
```

This interactively asks the user's framework, database, and industry — then generates config files and installs dependencies.

For non-interactive setup (if you already know what the user needs):

```bash
npx @trackpaw/cli init --framework <framework> --db <database> --preset <preset>
```

### Options

| Flag | Values | Default |
|------|--------|---------|
| `--framework` | `express`, `nextjs`, `standalone` | (asks) |
| `--db` | `sqlite`, `postgres`, `mysql`, `clickhouse` | (asks) |
| `--preset` | `saas`, `ecommerce`, `media`, `custom` | (asks) |
| `--port` | any number | `3000` |
| `--api-key` | any string | (auto-generated) |

### Industry presets

- **saas** — sign_up, login, onboarding, feature_used, subscriptions, invites, feedback
- **ecommerce** — product_viewed, add_to_cart, checkout flow, coupons, reviews, refunds
- **media** — content_viewed/started/completed, shares, bookmarks, paywall, newsletters

### What the CLI generates

- `.env` — API key and database connection vars
- Server setup code (framework-specific)
- Client-side tracker snippet or module
- `trackpaw-events.ts` — typed event catalog from the chosen preset

## Packages

- `@trackpaw/server` — Analytics server with Express router, supports SQLite/Postgres/MySQL/ClickHouse
- `@trackpaw/tracker` — Client-side SDK (<5KB), zero dependencies
- `@trackpaw/dashboard` — Embeddable React analytics dashboard
- `@trackpaw/cli` — Setup CLI tool

## Development (monorepo)

```bash
pnpm install    # Install deps
pnpm build      # Build all packages
pnpm test       # Run tests
```
