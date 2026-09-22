const pool = require('../db/pool');

// Sends a push notification via Expo's push API. No SDK needed — it's a
// plain HTTPS POST to Expo's servers, which then relay it to the device
// over FCM/APNs depending on platform.
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

async function sendPushNotification(title, body, data = {}) {
  const { rows } = await pool.query('SELECT push_token FROM settings LIMIT 1');
  const pushToken = rows[0]?.push_token;

  // No token registered yet (app never opened / permissions not granted) —
  // silently skip rather than failing the order-import request over it.
  if (!pushToken) {
    console.log('No push token registered, skipping notification.');
    return;
  }

  const message = {
    to: pushToken,
    sound: 'default',
    title,
    body,
    data,
  };

  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();
    if (result.data?.status === 'error') {
      console.error('Expo push notification error:', result.data.message);
    }
  } catch (err) {
    // Notification failures should never break the actual order-creation
    // flow that triggered them — just log it.
    console.error('Failed to send push notification:', err);
  }
}

module.exports = { sendPushNotification };