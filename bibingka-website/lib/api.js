// Single place for every call to the backend's public ordering API.
// Base URL comes from an env var so it's never hardcoded — see
// .env.local.example. All endpoints here are the unauthenticated
// /api/public/* routes; nothing here ever touches the admin API.

const BASE_URL = process.env.NEXT_PUBLIC_API_URL;

async function request(path, options = {}) {
  if (!BASE_URL) {
    throw new Error(
      'NEXT_PUBLIC_API_URL is not set. Copy .env.local.example to .env.local and fill it in.'
    );
  }

  const response = await fetch(`${BASE_URL}${path}`, options);
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    // The backend's quota-rejection response includes a customer-facing
    // "error" message plus a "reason" code (closed / exceeds_capacity) —
    // surface both so the UI can decide how to react.
    const err = new Error(body.error || `Request failed: ${response.status}`);
    err.reason = body.reason;
    err.remaining = body.remaining;
    err.status = response.status;
    throw err;
  }

  return body;
}

// GET /api/public/products — read-only menu. Each row is one purchasable
// bundle size (e.g. "Classic Bibingka - 4 pcs"), not a nested variant —
// that's how the backend's products table is structured. Grouping into
// "Classic Bibingka" with multiple bundle options happens on the frontend,
// see lib/groupProducts.js.
export function getProducts() {
  return request('/products');
}

// GET /api/public/availability?date=2026-12-24
// DISPLAY ONLY. The backend's order-creation endpoint re-checks capacity
// atomically and is the real authority — this is just what we show the
// customer before they submit.
export function getAvailability(date) {
  return request(`/availability?date=${encodeURIComponent(date)}`);
}

// POST /api/public/upload-payment-screenshot
// multipart/form-data, field name "screenshot". Returns { url }.
// Call this BEFORE order submission and pass the returned url as
// paymentScreenshotUrl in createOrder's payload.
export function uploadPaymentScreenshot(file) {
  const formData = new FormData();
  formData.append('screenshot', file);
  return request('/upload-payment-screenshot', {
    method: 'POST',
    body: formData,
  });
}

// POST /api/public/orders
// payload shape must match backend/src/routes/public.js exactly:
// { customer: {name, phone, email}, pickup: {date, time}, items: [{productId, quantity}],
//   notes, paymentMethod, paymentScreenshotUrl }
export function createOrder(payload) {
  return request('/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}
