// Your computer's local IP on the same WiFi network as your phone/emulator —
// NOT localhost, since the phone/emulator is a separate device on the network.
// Find yours by running `ipconfig` (Windows) and looking for "IPv4 Address"
// under your active WiFi adapter.
const BASE_URL = 'http://192.168.254.108:4000/api';

const APP_TOKEN = 'change-me-later'; // must match backend .env APP_ACCESS_TOKEN

async function apiFetch(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-app-token': APP_TOKEN,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || `Request failed: ${response.status}`);
  }

  return response.json();
}

export default apiFetch;