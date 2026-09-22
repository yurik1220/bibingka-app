/**
 * Paste this into Extensions > Apps Script on the Google Form (or its
 * linked Sheet), then set up an "On form submit" trigger to call
 * onFormSubmit(e).
 *
 * IMPORTANT: update FORM_FIELD_TO_PRODUCT_ID below to match your actual
 * form's product dropdown labels -> your products table IDs. This is the
 * one thing you'll need to touch whenever products change.
 */

const API_URL = 'https://your-backend-url.example.com/api/orders/import';
const FORM_IMPORT_SECRET = 'change-me-too'; // must match backend .env

// The exact question title of the file-upload question for the payment
// screenshot. Must match your Form exactly.
const PAYMENT_SCREENSHOT_QUESTION_TITLE = 'Payment Screenshot';

// Map the exact text of your form's product dropdown option to the
// product's ID in your `products` table. Update this whenever you add,
// rename, or remove a product.
const FORM_FIELD_TO_PRODUCT_ID = {
  'Classic Bibingka': 1,
  'Cheese Bibingka': 2,
  'Special Bibingka': 3,
};

function onFormSubmit(e) {
  const responses = e.namedValues; // { "Question title": ["answer"] }
  const responseId = e.response.getId();

  // Adjust these keys to match your actual form question titles exactly.
  const customerName = getAnswer(responses, 'Full Name');
  const customerPhone = getAnswer(responses, 'Phone Number');
  // "Pickup or Delivery?" should be a Multiple Choice question with options
  // exactly "Pickup" / "Delivery", using section branching to show the
  // right follow-up questions per your Form setup.
  const fulfillmentChoice = (getAnswer(responses, 'Pickup or Delivery?') || 'Pickup').toLowerCase();
  const fulfillmentType = fulfillmentChoice.includes('deliver') ? 'delivery' : 'pickup';

  // These question titles should exist in both the Pickup and Delivery
  // sections of your Form (e.g. "Pickup Date" / "Delivery Date" — adjust
  // to match whatever you actually named them).
  const pickupDate = getAnswer(responses, 'Pickup Date') || getAnswer(responses, 'Delivery Date');
  const pickupTime = getAnswer(responses, 'Pickup Time') || getAnswer(responses, 'Preferred Time');
  const deliveryAddress = fulfillmentType === 'delivery'
    ? getAnswer(responses, 'Delivery Address')
    : null;
  const customerNote = getAnswer(responses, 'Note (optional)');
  const productLabel = getAnswer(responses, 'Product');
  const quantity = Number(getAnswer(responses, 'Quantity'));
  const paymentMethod = (getAnswer(responses, 'Payment Method') || '').toLowerCase();

  // File upload questions don't show up as usable URLs in e.namedValues —
  // only the uploaded filename does. Pull the actual Drive file ID from
  // the structured item responses instead, then build a shareable URL.
  const paymentScreenshotUrl = getFileUploadUrl(e.response, PAYMENT_SCREENSHOT_QUESTION_TITLE);

  const productId = FORM_FIELD_TO_PRODUCT_ID[productLabel];

  const payload = {
    google_form_response_id: responseId,
    customer_name: customerName,
    customer_phone: customerPhone,
    pickup_date: pickupDate,
    pickup_time: pickupTime,
    fulfillment_type: fulfillmentType,
    delivery_address: deliveryAddress,
    customer_note: customerNote,
    items: productId
      ? [{ product_id: productId, quantity: quantity || 1 }]
      : [], // empty -> backend flags order as needs_review
    payment_method: paymentMethod || 'other',
    payment_screenshot_url: paymentScreenshotUrl || null,
    raw_import: responses, // full raw payload, kept as a debug fallback
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-form-import-secret': FORM_IMPORT_SECRET },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  const result = UrlFetchApp.fetch(API_URL, options);
  Logger.log(result.getContentText());
}

function getAnswer(responses, questionTitle) {
  const values = responses[questionTitle];
  return values && values.length > 0 ? values[0] : null;
}

// Finds the file-upload item response matching questionTitle, extracts the
// Drive file ID(s) it contains, makes the file viewable via link (so your
// backend/app can display it without the customer's own Drive permissions),
// and returns a shareable URL for the first uploaded file.
//
// Google Forms file-upload responses come back as an array of Drive file
// IDs (customers can technically upload more than one file per question,
// though this Form only asks for one screenshot).
function getFileUploadUrl(formResponse, questionTitle) {
  const itemResponses = formResponse.getItemResponses();

  for (const itemResponse of itemResponses) {
    if (itemResponse.getItem().getTitle() !== questionTitle) continue;

    const rawResponse = itemResponse.getResponse();
    // rawResponse is an array of file IDs for FILE_UPLOAD items.
    const fileIds = Array.isArray(rawResponse) ? rawResponse : [rawResponse];
    if (fileIds.length === 0 || !fileIds[0]) return null;

    try {
      const file = DriveApp.getFileById(fileIds[0]);
      // Ensure whoever has the link can view it — uploaded files default
      // to only the form owner having access, which would block the
      // backend/app from displaying the image.
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      return file.getUrl();
    } catch (err) {
      Logger.log('Could not access uploaded payment screenshot: ' + err.message);
      return null;
    }
  }

  return null;
}