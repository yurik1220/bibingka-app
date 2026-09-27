# Bibingka ni Ate — Ordering Site

Customer-facing pre-order website. Talks only to the public, unauthenticated
`/api/public/*` endpoints on the existing backend — it never touches the
admin API the mobile app uses.

## Setup

1. `npm install`
2. `cp .env.local.example .env.local` and set `NEXT_PUBLIC_API_URL` to your
   backend's public API base (e.g. `https://bibingka-app.onrender.com/api/public`)
3. `npm run dev` and open `http://localhost:3000`

## How it's organized

- `lib/api.js` — every backend call lives here. Nothing else in the app
  calls `fetch` directly.
- `lib/groupProducts.js` — the backend stores each bundle size as its own
  product row (e.g. "Classic Bibingka - 4 pcs"); this groups them back into
  one card per flavor for display.
- `components/OrderFlow.js` — the whole checkout wizard (Menu → Pickup →
  Details → Payment → Review → Confirmation) and its state. This is the
  file to open first.
- `components/` — everything else is a presentational piece used by
  OrderFlow.

## Known gaps, on purpose

- **Pickup time slots are hardcoded** in `OrderFlow.js` (see the
  `TIME_SLOTS` constant) because there's no public endpoint exposing
  `settings.pickup_times` yet. Update the constant to match what's
  actually configured, or add that endpoint and wire it up.
- **Payment screenshot upload is optional**, not required, matching how
  the backend's `payments.screenshot_url` column is nullable. If you want
  to require it before checkout, that's a one-line change in
  `OrderFlow.js`'s Review step gating.
- The backend's atomic capacity check is the real authority — this
  frontend's availability display is just for showing the customer
  something before they submit. If capacity changes mid-checkout, the
  order endpoint will reject it and the UI sends the customer back to the
  Pickup step with the reason shown.

## Deploying

Built for Vercel. Set `NEXT_PUBLIC_API_URL` as an environment variable in
the Vercel project settings (not committed to the repo) before deploying.
