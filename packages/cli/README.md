# @trackpaw/cli

One-command setup for [Trackpaw](https://github.com/arponsd/trackpaw) — self-hosted, privacy-first analytics.

## Quick Start

```bash
npx @trackpaw/cli init
```

The CLI asks your framework, database, and product type — then scaffolds everything and installs dependencies. Done in seconds.

## Non-interactive mode

Skip the prompts (great for AI assistants):

```bash
npx @trackpaw/cli init --framework express --db sqlite --preset saas
```

### Options

| Flag | Values | Default |
|------|--------|---------|
| `--framework` | `express`, `nextjs`, `standalone` | (asks) |
| `--db` | `sqlite`, `postgres`, `mysql`, `clickhouse` | (asks) |
| `--preset` | `saas`, `ecommerce`, `media`, `custom` | (asks) |
| `--port` | any number | `3000` |
| `--api-key` | any string | (auto-generated) |

## Industry Presets

Each preset comes with standard events so you don't have to figure out what to track.

**SaaS** — sign_up, login, onboarding_started, onboarding_completed, feature_used, subscription_started, subscription_cancelled, subscription_upgraded, invite_sent, invite_accepted, support_ticket_created, feedback_submitted

**E-Commerce** — product_viewed, product_searched, add_to_cart, remove_from_cart, checkout_started, checkout_completed, checkout_abandoned, coupon_applied, wishlist_added, review_submitted, refund_requested

**Media / Content** — content_viewed, content_started, content_completed, content_shared, content_bookmarked, comment_posted, search_performed, newsletter_subscribed, ad_clicked, paywall_hit, subscription_started

## What it generates

- `.env` — API key and database connection variables
- Server setup code (framework-specific)
- Client-side tracker snippet or module
- `trackpaw-events.ts` — typed event catalog from your chosen preset

## List preset events

```bash
npx @trackpaw/cli events saas
npx @trackpaw/cli events ecommerce
npx @trackpaw/cli events media
```

## License

MIT
