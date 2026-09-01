const cloudinary = require("cloudinary").v2;
const multer = require("multer");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

const MAX_BYTES = 8 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter(req, file, cb) {
    if (!/^image\/(jpe?g|png|gif|webp|heic|heif)$/i.test(file.mimetype)) {
      return cb(new Error("Only JPG, PNG, GIF, WEBP or HEIC images are allowed."));
    }
    cb(null, true);
  }
});

function isConfigured() {
  return Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
}

/** Upload a multer memory buffer. Resolves to { secure_url, public_id }. */
function uploadBuffer(buffer, folder = "recipes") {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
        // Store a sane master size; delivery transformations (f_auto,q_auto,w_) happen at request time.
        transformation: [{ width: 1600, height: 1200, crop: "limit" }],
        format: "jpg"
      },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(buffer);
  });
}

async function destroy(publicId) {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.warn("cloudinary destroy failed", publicId, err.message);
  }
}

module.exports = { cloudinary, upload, uploadBuffer, destroy, isConfigured, MAX_BYTES };
