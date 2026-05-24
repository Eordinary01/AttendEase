const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

// Generate secure filename
const generateSecureFilename = (originalname) => {
  const randomBytes = crypto.randomBytes(16).toString('hex');
  const timestamp = Date.now();
  const ext = path.extname(originalname);
  return `${timestamp}-${randomBytes}${ext}`;
};

// Configure storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/';
    // Create directory if it doesn't exist
    require('fs').mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Use secure random filename
    const secureFilename = generateSecureFilename(file.originalname);
    cb(null, secureFilename);
  }
});

// Enhanced file validation
const checkFileType = (file, cb) => {
  const allowedTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  };

  const ext = path.extname(file.originalname).toLowerCase();
  const mimetype = file.mimetype;

  if (!allowedTypes[ext]) {
    return cb(new Error(`File type ${ext} not allowed.`));
  }

  if (allowedTypes[ext] !== mimetype) {
    return cb(new Error(`MIME type mismatch for ${ext}`));
  }

  cb(null, true);
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 5 // Max 5 files
  },
  fileFilter: function (req, file, cb) {
    checkFileType(file, cb);
  }
});

module.exports = upload;