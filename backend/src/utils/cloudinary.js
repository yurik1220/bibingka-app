const cloudinary = require('cloudinary').v2;

// Requires CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
// set as env vars on Render (and locally in .env for dev).
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Uploads a file buffer (from multer's memory storage) to Cloudinary and
// returns the resulting secure URL. Used for customer-uploaded GCash
// payment screenshots on the public ordering site.
function uploadBuffer(buffer, folder = 'bibingka-payments') {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'image' },
      (error, result) => {
        if (error) return reject(error);
        resolve(result.secure_url);
      }
    );
    stream.end(buffer);
  });
}

module.exports = { uploadBuffer };