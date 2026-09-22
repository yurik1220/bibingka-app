# Bibingka ni Ate

A mobile app for managing Christmas bibingka orders, production, payments,
and sales — built for a single user, fed by orders coming in through a
Google Form.

## Structure

```
backend/    Node/Express API + PostgreSQL
mobile/     React Native (Expo) app  [not scaffolded yet]
```

## Backend setup

```bash
cd backend
cp .env.example .env      # then fill in DATABASE_URL, APP_ACCESS_TOKEN, FORM_IMPORT_SECRET
npm install
npm run migrate           # runs 001_init.sql and 002_add_delivery.sql in order
npm run dev                # starts the API on http://localhost:4000
```

## Google Form integration

1. Build your Google Form with these questions (names matter — the Apps
   Script below matches on exact question titles):
   Full Name, Phone Number, **Pickup or Delivery?** (Multiple choice:
   Pickup / Delivery — use Section branching so Pickup shows Pickup
   Date/Time, and Delivery shows Delivery Date, Preferred Time, and
   Delivery Address), Note (optional), Product (dropdown — must match
   product names exactly), Quantity, Payment Method, Payment Screenshot
   (file upload).
   The customer covers the Lalamove/Grab fee directly with the rider —
   the app does not track or collect a delivery fee.
2. Open the form's linked Sheet (or the form itself) → **Extensions > Apps
   Script**, paste in `backend/google-apps-script/onFormSubmit.gs`.
3. Update `API_URL`, `FORM_IMPORT_SECRET`, and `FORM_FIELD_TO_PRODUCT_ID`
   (map each dropdown option to the product's real ID once you've created
   your products via `POST /api/products`).
4. In the Apps Script editor: **Triggers (clock icon) → Add Trigger →
   `onFormSubmit` → On form submit**.

Any order the script can't map to a known product still gets created,
tagged `needs_review`, so nothing silently disappears — you just have to
fix it manually in that case.

## API overview

| Endpoint | Purpose |
|---|---|
| `GET /api/dashboard` | Today's summary numbers |
| `GET/POST/PATCH /api/products` | Menu management |
| `GET /api/orders`, `GET /api/orders/:id` | List/detail |
| `PATCH /api/orders/:id/status` | Move an order through its lifecycle |
| `POST /api/orders/import` | Called by Apps Script only |
| `PATCH /api/payments/:id` | Verify/reject a payment |
| `GET/PATCH /api/production/:date` | Daily production view |
| `GET /api/reports/sales` etc. | Computed sales/reporting |
| `GET/PATCH /api/settings` | Business settings |

All routes except `/api/orders/import` require an `x-app-token` header
matching `APP_ACCESS_TOKEN` (hardcoded single-user auth for v1).

## Next steps

- [ ] Scaffold `mobile/` with Expo
- [ ] Wire up push notifications (Expo push service)
- [ ] Build out the 8 screens against this API
