const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

// Set up storage for uploaded files
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadsDir = path.join(__dirname, '../uploads');
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(8).toString('hex');
    cb(null, 'enrollment-' + uniqueSuffix + '.csv');
  }
});

// File filter - allow CSV files by extension AND MIME type
const fileFilter = (req, file, cb) => {
  const allowedExtensions = ['.csv'];
  const allowedMimeTypes = ['text/csv', 'application/vnd.ms-excel', 'text/plain'];
  const fileExtension = path.extname(file.originalname).toLowerCase();
  
  const extOk = allowedExtensions.includes(fileExtension);
  const mimeOk = allowedMimeTypes.includes(file.mimetype);
  
  if (extOk && mimeOk) {
    cb(null, true);
  } else if (extOk && !mimeOk) {
    cb(new Error('File content type does not match CSV format'), false);
  } else {
    cb(new Error('Only CSV files are allowed'), false);
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

module.exports = upload;