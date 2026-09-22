// v1: no real login yet. The mobile app sends a shared access token in a
// header, and we just check it matches the one in .env. Swap this out for
// real per-user auth later without touching any route handlers, since they
// just call `requireAuth` as middleware.

function requireAuth(req, res, next) {
  const token = req.headers['x-app-token'];

  if (!token || token !== process.env.APP_ACCESS_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
}

// Separate, stricter check for the one endpoint the outside world (Apps
// Script) calls directly — never reuse the app token for this.
function requireFormImportSecret(req, res, next) {
  const secret = req.headers['x-form-import-secret'];

  if (!secret || secret !== process.env.FORM_IMPORT_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
}

module.exports = { requireAuth, requireFormImportSecret };
