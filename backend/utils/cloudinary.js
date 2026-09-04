/**
 * CLOUDINARY FILE UPLOAD UTILITY
 * Handles unified media & file uploads to Cloudinary with automatic
 * optimization, folder structuring, and fallback to local disk storage.
 */

const fs = require('fs');
const path = require('path');
const logger = require('./logger');

let cloudinary = null;
try {
  cloudinary = require('cloudinary').v2;
} catch (e) {
  logger.warn('Cloudinary package not installed yet, local disk fallback will be used.');
}

const isConfigured = Boolean(
  (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) ||
  process.env.CLOUDINARY_URL
);

if (cloudinary && isConfigured) {
  if (process.env.CLOUDINARY_URL) {
    cloudinary.config({
      cloudinary_url: process.env.CLOUDINARY_URL,
      secure: true,
    });
  } else {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
  }
  logger.info('Cloudinary storage engine initialized successfully.');
} else {
  logger.info('Cloudinary credentials not detected in .env — using local disk storage fallback (/uploads).');
}

/**
 * Check whether Cloudinary is active and ready
 */
const isCloudinaryConfigured = () => {
  return Boolean(cloudinary && isConfigured);
};

/**
 * Upload file buffer or local file path to Cloudinary (or local disk fallback)
 *
 * @param {Buffer|string} fileInput - Buffer from multer or local file path string
 * @param {Object} options - Upload options
 * @param {string} [options.folder='attendease/uploads'] - Cloudinary folder path
 * @param {string} [options.publicId] - Optional custom public ID
 * @param {string} [options.resourceType='auto'] - 'image' | 'raw' | 'auto' | 'video'
 * @param {Array|Object} [options.transformation] - E.g. [{ width: 400, height: 400, crop: 'fill', gravity: 'face' }]
 * @param {string} [options.originalName] - Original filename for fallback extension matching
 * @returns {Promise<{ success: boolean, url: string, publicId: string, bytes?: number }>}
 */
const uploadToCloudinary = async (fileInput, options = {}) => {
  const {
    folder = 'attendease/uploads',
    publicId,
    resourceType = 'auto',
    transformation,
    originalName,
  } = options;

  // --- 1. Cloudinary upload path ---
  if (isCloudinaryConfigured()) {
    try {
      if (Buffer.isBuffer(fileInput)) {
        return await new Promise((resolve, reject) => {
          const uploadOptions = {
            folder,
            resource_type: resourceType,
            public_id: publicId,
            transformation,
            overwrite: true,
          };

          const stream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
            if (error) {
              logger.error('Cloudinary stream upload error', { error: error.message });
              return reject(new Error(`Cloudinary upload failed: ${error.message}`));
            }
            resolve({
              success: true,
              url: result.secure_url || result.url,
              publicId: result.public_id,
              format: result.format,
              bytes: result.bytes,
            });
          });

          stream.end(fileInput);
        });
      } else if (typeof fileInput === 'string') {
        const result = await cloudinary.uploader.upload(fileInput, {
          folder,
          resource_type: resourceType,
          public_id: publicId,
          transformation,
          overwrite: true,
        });

        return {
          success: true,
          url: result.secure_url || result.url,
          publicId: result.public_id,
          format: result.format,
          bytes: result.bytes,
        };
      }
    } catch (err) {
      logger.warn('Cloudinary upload failed, attempting local fallback', { error: err.message });
    }
  }

  // --- 2. Local disk fallback ---
  try {
    const safeSubfolder = folder.replace(/^attendease\//, '').replace(/[^a-zA-Z0-9_-]/g, '_');
    const uploadDir = path.join(__dirname, '../uploads', safeSubfolder);

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const ext = originalName ? path.extname(originalName) : '.png';
    const filename = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}${ext}`;
    const targetFilePath = path.join(uploadDir, filename);

    if (Buffer.isBuffer(fileInput)) {
      fs.writeFileSync(targetFilePath, fileInput);
    } else if (typeof fileInput === 'string' && fs.existsSync(fileInput)) {
      fs.copyFileSync(fileInput, targetFilePath);
    } else {
      throw new Error('Invalid file input provided for local storage');
    }

    const relativeUrl = `/uploads/${safeSubfolder}/${filename}`;
    logger.debug(`File stored locally at ${relativeUrl}`);

    return {
      success: true,
      url: relativeUrl,
      publicId: `${safeSubfolder}/${filename}`,
      bytes: Buffer.isBuffer(fileInput) ? fileInput.length : 0,
    };
  } catch (localErr) {
    logger.error('Local fallback storage error', { error: localErr.message });
    throw new Error(`Failed to save file: ${localErr.message}`);
  }
};

/**
 * Delete file from Cloudinary (or local disk fallback)
 *
 * @param {string} publicId - Cloudinary publicId or local relative path
 * @param {string} [resourceType='image'] - 'image' | 'raw'
 */
const deleteFromCloudinary = async (publicId, resourceType = 'image') => {
  if (!publicId) return;

  if (isCloudinaryConfigured() && !publicId.startsWith('/uploads')) {
    try {
      await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
      logger.debug(`Deleted ${publicId} from Cloudinary`);
      return true;
    } catch (err) {
      logger.warn(`Failed to delete ${publicId} from Cloudinary:`, { error: err.message });
    }
  }

  // Local fallback cleanup
  try {
    const cleanPath = publicId.replace(/^\/uploads\//, '');
    const localPath = path.join(__dirname, '../uploads', cleanPath);
    if (fs.existsSync(localPath)) {
      fs.unlinkSync(localPath);
      logger.debug(`Deleted local file ${localPath}`);
      return true;
    }
  } catch (err) {
    logger.warn(`Failed to delete local file ${publicId}:`, { error: err.message });
  }

  return false;
};

module.exports = {
  cloudinary,
  isCloudinaryConfigured,
  uploadToCloudinary,
  deleteFromCloudinary,
};
