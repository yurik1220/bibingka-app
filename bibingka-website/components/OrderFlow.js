'use client';

import { useEffect, useState } from 'react';
import Header from './Header';
import StepIndicator from './StepIndicator';
import ProductCard from './ProductCard';
import CartPanel from './CartPanel';
import { getProducts, getAvailability, uploadPaymentScreenshot, createOrder } from '../lib/api';
import { groupProducts } from '../lib/groupProducts';

// Hardcoded until a public endpoint exposes settings.pickup_times —
// see backend/src/routes/settings.js. Update this list to match whatever
// Ate actually sets there, or wire it up once that endpoint exists.
const TIME_SLOTS = ['10:00 AM – 12:00 PM', '1:00 PM – 3:00 PM', '3:00 PM – 5:00 PM', '5:00 PM – 7:00 PM'];

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

export default function OrderFlow() {
  const [step, setStep] = useState(0); // 0 menu, 1 pickup, 2 details, 3 payment, 4 review, 5 confirmation

  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState(null);

  const [cart, setCart] = useState({}); // { [productId]: quantity }

  const [pickupDate, setPickupDate] = useState('');
  const [pickupTime, setPickupTime] = useState('');
  const [availability, setAvailability] = useState(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState(null);

  const [customer, setCustomer] = useState({ name: '', phone: '', email: '' });
  const [notes, setNotes] = useState('');

  const [paymentScreenshotUrl, setPaymentScreenshotUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [orderResult, setOrderResult] = useState(null);

  useEffect(() => {
    getProducts()
      .then(setProducts)
      .catch((err) => setProductsError(err.message))
      .finally(() => setProductsLoading(false));
  }, []);

  useEffect(() => {
    if (!pickupDate) {
      setAvailability(null);
      return;
    }
    setAvailabilityLoading(true);
    setAvailabilityError(null);
    getAvailability(pickupDate)
      .then(setAvailability)
      .catch((err) => setAvailabilityError(err.message))
      .finally(() => setAvailabilityLoading(false));
  }, [pickupDate]);

  const groups = groupProducts(products);
  const productById = Object.fromEntries(products.map((p) => [p.id, p]));

  const cartEntries = Object.entries(cart).filter(([, qty]) => qty > 0);
  const totalPieces = cartEntries.reduce((sum, [id, qty]) => {
    const p = productById[id];
    return sum + (p ? Number(p.pieces_per_bundle) || 1 : 0) * qty;
  }, 0);
  const totalPrice = cartEntries.reduce((sum, [id, qty]) => {
    const p = productById[id];
    return sum + (p ? Number(p.price) : 0) * qty;
  }, 0);
  const cartLines = cartEntries.map(([id, qty]) => {
    const p = productById[id];
    return {
      key: id,
      label: `${p?.name || 'Item'} × ${qty}`,
      subtotal: (p ? Number(p.price) : 0) * qty,
    };
  });

  function changeQty(productId, delta) {
    setCart((prev) => ({
      ...prev,
      [productId]: Math.max(0, (prev[productId] || 0) + delta),
    }));
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const { url } = await uploadPaymentScreenshot(file);
      setPaymentScreenshotUrl(url);
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await createOrder({
        customer,
        pickup: { date: pickupDate, time: pickupTime },
        items: cartEntries.map(([productId, quantity]) => ({
          productId: Number(productId),
          quantity,
        })),
        notes: notes || null,
        paymentMethod: 'gcash',
        paymentScreenshotUrl,
      });
      setOrderResult(result);
      setStep(5);
    } catch (err) {
      // Capacity changed while the customer was filling out the form —
      // send them back to Pickup so they can pick a different date/qty,
      // per the original spec's required UX for this exact scenario.
      if (err.reason === 'exceeds_capacity' || err.reason === 'closed') {
        setSubmitError(err.message);
        setStep(1);
        // Refresh availability for the current date so the Pickup step
        // reflects what just caused the rejection, not stale data from
        // before the customer filled out the rest of the form.
        getAvailability(pickupDate).then(setAvailability).catch(() => {});
      } else {
        setSubmitError(err.message || 'Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  const canContinueFromMenu = totalPieces > 0;
  const canContinueFromPickup =
    pickupDate &&
    pickupTime &&
    availability &&
    availability.status !== 'closed' &&
    availability.status !== 'sold_out' &&
    totalPieces <= availability.remaining;
  const canContinueFromDetails = customer.name.trim() && customer.phone.trim();

  if (step === 5 && orderResult) {
    return <Confirmation result={orderResult} />;
  }

  return (
    <div>
      <Header totalPieces={totalPieces} />
      <div className="shell">
        <div className="main">
          <div className="step-indicator-wrap">
            <StepIndicator currentIndex={step} />
          </div>

          {step === 0 && (
            <MenuStep
              productsLoading={productsLoading}
              productsError={productsError}
              groups={groups}
              cart={cart}
              onChangeQty={changeQty}
            />
          )}

          {step === 1 && (
            <PickupStep
              pickupDate={pickupDate}
              setPickupDate={setPickupDate}
              pickupTime={pickupTime}
              setPickupTime={setPickupTime}
              availability={availability}
              availabilityLoading={availabilityLoading}
              availabilityError={availabilityError}
              totalPieces={totalPieces}
              submitError={submitError}
            />
          )}

          {step === 2 && <DetailsStep customer={customer} setCustomer={setCustomer} notes={notes} setNotes={setNotes} />}

          {step === 3 && (
            <PaymentStep
              onFileChange={handleFileChange}
              uploading={uploading}
              uploadError={uploadError}
              paymentScreenshotUrl={paymentScreenshotUrl}
            />
          )}

          {step === 4 && (
            <ReviewStep
              cartLines={cartLines}
              totalPrice={totalPrice}
              totalPieces={totalPieces}
              pickupDate={pickupDate}
              pickupTime={pickupTime}
              customer={customer}
              notes={notes}
              paymentScreenshotUrl={paymentScreenshotUrl}
              submitError={submitError}
            />
          )}

          <div className="nav-buttons">
            {step > 0 && (
              <button type="button" className="ghost" onClick={() => setStep(step - 1)}>
                Back
              </button>
            )}
            {step < 4 && (
              <button
                type="button"
                className="primary"
                disabled={
                  (step === 0 && !canContinueFromMenu) ||
                  (step === 1 && !canContinueFromPickup) ||
                  (step === 2 && !canContinueFromDetails)
                }
                onClick={() => setStep(step + 1)}
              >
                Continue
              </button>
            )}
            {step === 4 && (
              <button type="button" className="primary" disabled={submitting} onClick={handleSubmit}>
                {submitting ? 'Placing order...' : 'Place order'}
              </button>
            )}
          </div>
        </div>

        {step < 4 && (
          <CartPanel
            lines={cartLines}
            totalPrice={totalPrice}
            totalPieces={totalPieces}
            ctaLabel="Continue"
            ctaDisabled={
              (step === 0 && !canContinueFromMenu) ||
              (step === 1 && !canContinueFromPickup) ||
              (step === 2 && !canContinueFromDetails)
            }
            onCta={() => setStep(step + 1)}
          />
        )}
      </div>

      <style jsx>{`
        .shell {
          max-width: 1100px;
          margin: 0 auto;
          padding: 20px 20px 100px;
          display: grid;
          grid-template-columns: 1fr;
          gap: 20px;
        }
        .step-indicator-wrap {
          margin-bottom: 4px;
        }
        .nav-buttons {
          display: flex;
          justify-content: space-between;
          margin-top: 20px;
        }
        .nav-buttons button {
          padding: 13px 24px;
          border-radius: 12px;
          font-weight: 700;
          font-size: 14.5px;
          border: none;
        }
        .nav-buttons .primary {
          background: var(--terracotta);
          color: #fff;
          margin-left: auto;
        }
        .nav-buttons .primary:disabled {
          opacity: 0.5;
        }
        .nav-buttons .ghost {
          background: transparent;
          color: var(--ink);
          border: 1.5px solid var(--line);
        }

        @media (min-width: 860px) {
          .shell {
            grid-template-columns: 1fr 320px;
            align-items: start;
            padding-bottom: 40px;
          }
        }
      `}</style>
    </div>
  );
}

function MenuStep({ productsLoading, productsError, groups, cart, onChangeQty }) {
  if (productsLoading) return <p className="muted">Loading menu...</p>;
  if (productsError) return <p className="error">Couldn't load the menu: {productsError}</p>;
  if (groups.length === 0) return <p className="muted">No products available right now.</p>;

  return (
    <div>
      <h2>Menu</h2>
      {groups.map((group) => (
        <ProductCard key={group.flavor} group={group} cart={cart} onChangeQty={onChangeQty} />
      ))}
      <style jsx>{`
        h2 {
          font-size: 19px;
          margin-bottom: 14px;
        }
      `}</style>
    </div>
  );
}

function PickupStep({
  pickupDate, setPickupDate, pickupTime, setPickupTime,
  availability, availabilityLoading, availabilityError, totalPieces, submitError,
}) {
  const exceedsCapacity = availability && availability.status !== 'closed' && totalPieces > availability.remaining;

  return (
    <div className="card">
      <h2>Pickup</h2>

      {submitError && <div className="banner">{submitError}</div>}

      <div className="field">
        <label>Pickup date</label>
        <input
          type="date"
          min={todayString()}
          value={pickupDate}
          onChange={(e) => setPickupDate(e.target.value)}
        />
      </div>

      {pickupDate && availabilityLoading && <p className="muted">Checking availability...</p>}
      {pickupDate && availabilityError && <p className="error">Couldn't check availability: {availabilityError}</p>}

      {pickupDate && availability && !availabilityLoading && (
        <div className={`status ${availability.status}`}>
          {availability.status === 'closed' && "This date isn't open for pickup yet. Please choose another date."}
          {availability.status === 'sold_out' && 'Sorry, this date is sold out. Please choose another date.'}
          {availability.status === 'limited' && `Only ${availability.remaining} piece${availability.remaining === 1 ? '' : 's'} left for this date.`}
          {availability.status === 'available' && `${availability.remaining} pieces available for this date.`}
        </div>
      )}

      {exceedsCapacity && (
        <div className="banner">
          Your order needs {totalPieces} pieces, but only {availability.remaining} are left on this date. Reduce your order or choose another date.
        </div>
      )}

      <div className="field">
        <label>Pickup time</label>
        <div className="slots">
          {TIME_SLOTS.map((slot) => (
            <button
              key={slot}
              type="button"
              className={pickupTime === slot ? 'slot selected' : 'slot'}
              onClick={() => setPickupTime(slot)}
            >
              {slot}
            </button>
          ))}
        </div>
      </div>

      <style jsx>{`
        .card {
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 18px;
          padding: 20px;
        }
        h2 {
          font-size: 17px;
          margin-bottom: 14px;
        }
        .banner {
          background: #fdecea;
          color: #a34;
          border-radius: 10px;
          padding: 12px 14px;
          font-size: 13.5px;
          margin-bottom: 14px;
        }
        .field {
          margin-bottom: 16px;
        }
        label {
          display: block;
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 6px;
        }
        input[type='date'] {
          width: 100%;
          border: 1.5px solid var(--line);
          border-radius: 10px;
          padding: 11px 12px;
          font-size: 14.5px;
          background: var(--cream);
          color: var(--ink);
        }
        .status {
          border-radius: 10px;
          padding: 10px 14px;
          font-size: 13.5px;
          margin-bottom: 16px;
        }
        .status.available {
          background: #eaf3ec;
          color: #2f6b40;
        }
        .status.limited {
          background: #fbeee3;
          color: var(--terracotta);
        }
        .status.sold_out,
        .status.closed {
          background: #fdecea;
          color: #a34;
        }
        .slots {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .slot {
          border: 1.5px solid var(--line);
          background: var(--cream);
          border-radius: 10px;
          padding: 9px 13px;
          font-size: 13.5px;
        }
        .slot.selected {
          background: var(--pine);
          border-color: var(--pine);
          color: #fff;
        }
        .muted {
          color: var(--ink-soft);
          font-size: 13.5px;
        }
        .error {
          color: #a34;
          font-size: 13.5px;
        }
      `}</style>
    </div>
  );
}

function DetailsStep({ customer, setCustomer, notes, setNotes }) {
  return (
    <div className="card">
      <h2>Your details</h2>
      <div className="field">
        <label>Full name</label>
        <input
          type="text"
          placeholder="Juan Dela Cruz"
          value={customer.name}
          onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
        />
      </div>
      <div className="field">
        <label>Mobile number</label>
        <input
          type="tel"
          placeholder="09XX XXX XXXX"
          value={customer.phone}
          onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
        />
      </div>
      <div className="field">
        <label>Email (optional)</label>
        <input
          type="email"
          placeholder="juan@example.com"
          value={customer.email}
          onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
        />
      </div>
      <div className="field" style={{ marginBottom: 0 }}>
        <label>Order notes (optional)</label>
        <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything we should know?" />
      </div>

      <style jsx>{`
        .card {
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 18px;
          padding: 20px;
        }
        h2 {
          font-size: 17px;
          margin-bottom: 14px;
        }
        .field {
          margin-bottom: 14px;
        }
        label {
          display: block;
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 6px;
        }
        input,
        textarea {
          width: 100%;
          border: 1.5px solid var(--line);
          border-radius: 10px;
          padding: 11px 12px;
          font-size: 14.5px;
          background: var(--cream);
          color: var(--ink);
        }
      `}</style>
    </div>
  );
}

function PaymentStep({ onFileChange, uploading, uploadError, paymentScreenshotUrl }) {
  return (
    <div className="card">
      <h2>Payment</h2>
      <div className="gcash">
        <div className="icon">GC</div>
        <div className="details">
          <b>0917 123 4567</b>
          <br />
          Bibingka ni Ate — send the exact amount, then upload your receipt below.
        </div>
      </div>

      <label className="upload">
        {uploading && 'Uploading...'}
        {!uploading && paymentScreenshotUrl && 'Screenshot uploaded — tap to replace'}
        {!uploading && !paymentScreenshotUrl && 'Tap to upload payment screenshot'}
        <input type="file" accept="image/*" onChange={onFileChange} hidden />
      </label>
      {uploadError && <p className="error">{uploadError}</p>}
      {!paymentScreenshotUrl && <p className="muted">Optional, but it helps us verify your payment faster.</p>}

      <style jsx>{`
        .card {
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 18px;
          padding: 20px;
        }
        h2 {
          font-size: 17px;
          margin-bottom: 14px;
        }
        .gcash {
          display: flex;
          align-items: center;
          gap: 12px;
          background: var(--cream);
          border: 1.5px dashed var(--gold);
          border-radius: 12px;
          padding: 14px;
          margin-bottom: 14px;
        }
        .icon {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          background: #1279be;
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 12px;
          flex-shrink: 0;
        }
        .details {
          font-size: 13.5px;
          line-height: 1.5;
        }
        .details b {
          font-family: var(--font-fraunces), serif;
          font-size: 15px;
        }
        .upload {
          display: block;
          border: 1.5px dashed var(--line);
          border-radius: 12px;
          padding: 20px;
          text-align: center;
          color: var(--ink-soft);
          font-size: 13.5px;
        }
        .muted {
          color: var(--ink-soft);
          font-size: 12.5px;
          margin-top: 8px;
        }
        .error {
          color: #a34;
          font-size: 13px;
          margin-top: 8px;
        }
      `}</style>
    </div>
  );
}

function ReviewStep({ cartLines, totalPrice, totalPieces, pickupDate, pickupTime, customer, notes, paymentScreenshotUrl, submitError }) {
  return (
    <div className="card">
      <h2>Review your order</h2>

      {submitError && <div className="banner">{submitError}</div>}

      <div className="section">
        <div className="label">Items</div>
        {cartLines.map((line) => (
          <div key={line.key} className="row">
            <span>{line.label}</span>
            <span>₱{line.subtotal}</span>
          </div>
        ))}
        <div className="row total">
          <span>Total ({totalPieces} pcs)</span>
          <span>₱{totalPrice}</span>
        </div>
      </div>

      <div className="section">
        <div className="label">Pickup</div>
        <div>{pickupDate} — {pickupTime}</div>
      </div>

      <div className="section">
        <div className="label">Customer</div>
        <div>{customer.name}</div>
        <div>{customer.phone}</div>
        {customer.email && <div>{customer.email}</div>}
        {notes && <div className="notes">"{notes}"</div>}
      </div>

      <div className="section" style={{ marginBottom: 0 }}>
        <div className="label">Payment</div>
        <div>GCash — {paymentScreenshotUrl ? 'screenshot attached' : 'no screenshot uploaded'}</div>
      </div>

      <style jsx>{`
        .card {
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 18px;
          padding: 20px;
        }
        h2 {
          font-size: 17px;
          margin-bottom: 14px;
        }
        .banner {
          background: #fdecea;
          color: #a34;
          border-radius: 10px;
          padding: 12px 14px;
          font-size: 13.5px;
          margin-bottom: 14px;
        }
        .section {
          margin-bottom: 16px;
          padding-bottom: 14px;
          border-bottom: 1px solid var(--line);
          font-size: 14px;
        }
        .label {
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          color: var(--ink-soft);
          margin-bottom: 8px;
        }
        .row {
          display: flex;
          justify-content: space-between;
          padding: 3px 0;
        }
        .row.total {
          font-weight: 700;
          margin-top: 6px;
        }
        .notes {
          color: var(--ink-soft);
          font-style: italic;
          margin-top: 4px;
        }
      `}</style>
    </div>
  );
}

function Confirmation({ result }) {
  return (
    <div className="wrap">
      <div className="card">
        <div className="check">✓</div>
        <h1>Order received!</h1>
        <p className="thanks">Thank you for ordering from Bibingka ni Ate.</p>

        <div className="row">
          <span>Order number</span>
          <b>{result.order_number}</b>
        </div>
        <div className="row">
          <span>Pickup date</span>
          <b>{result.pickup_date}</b>
        </div>
        <div className="row">
          <span>Pickup time</span>
          <b>{result.pickup_time}</b>
        </div>
        <div className="row">
          <span>Total</span>
          <b>₱{result.total_amount}</b>
        </div>
        <div className="row">
          <span>Payment</span>
          <b>Pending verification</b>
        </div>

        <p className="keep">Please keep your order number for reference.</p>

        <button type="button" onClick={() => window.location.reload()}>
          Back to home
        </button>
      </div>

      <style jsx>{`
        .wrap {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .card {
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 20px;
          padding: 32px 28px;
          max-width: 380px;
          width: 100%;
          text-align: center;
        }
        .check {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: var(--pine);
          color: var(--gold);
          font-size: 22px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 16px;
        }
        h1 {
          font-size: 22px;
        }
        .thanks {
          color: var(--ink-soft);
          font-size: 14px;
          margin: 8px 0 20px;
        }
        .row {
          display: flex;
          justify-content: space-between;
          font-size: 14px;
          padding: 8px 0;
          border-bottom: 1px solid var(--line);
          text-align: left;
        }
        .keep {
          color: var(--ink-soft);
          font-size: 12.5px;
          margin-top: 16px;
        }
        button {
          margin-top: 20px;
          width: 100%;
          background: var(--pine);
          color: #fff;
          border: none;
          padding: 13px;
          border-radius: 12px;
          font-weight: 700;
          font-size: 14.5px;
        }
      `}</style>
    </div>
  );
}
