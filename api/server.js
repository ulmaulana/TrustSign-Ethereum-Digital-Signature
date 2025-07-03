const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Import existing server logic
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Setup multer untuk Vercel (menggunakan temporary storage)
const storage = multer.memoryStorage(); // Gunakan memory storage untuk Vercel
const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Format file tidak didukung! Hanya PDF yang diperbolehkan.'), false);
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Load hash-mapping 
let hashMapping = {};
try {
  if (fs.existsSync('./hash-mapping.json')) {
    const mappingData = fs.readFileSync('./hash-mapping.json', 'utf8');
    hashMapping = JSON.parse(mappingData);
    console.log(`Loaded ${Object.keys(hashMapping).length} hash mappings`);
  }
} catch (error) {
  console.error('Error loading hash mapping:', error);
  hashMapping = {};
}

// Copy all routes from original server.js
// NOTE: File operations will need modification for Vercel's file system constraints

// Endpoint upload (simplified for Vercel)
app.post('/api/upload', upload.single('file'), (req, res) => {
  console.log('Received upload request');
  
  if (!req.file) {
    return res.status(400).json({ error: 'Tidak ada file yang diterima' });
  }
  
  const { hash, signature, signer, txHash } = req.body;
  
  if (!hash || hash === 'undefined') {
    return res.status(400).json({ error: 'Hash tidak valid' });
  }
  
  const cleanHash = hash.startsWith('0x') ? hash.substring(2) : hash;
  
  // For Vercel, we'll need to use external storage (like AWS S3) or database
  // This is a simplified version that returns success
  res.json({
    success: true,
    url: `/uploads/${cleanHash}.pdf`,
    message: 'Dokumen berhasil diunggah',
    note: 'File storage needs external service for production'
  });
});

// Endpoint untuk prepare hash
app.post('/api/prepare-hash', express.json(), (req, res) => {
  const { hash, signature, signer, txHash, docIdString, originalHash } = req.body;
  
  if (!hash) {
    return res.status(400).json({ error: 'Hash diperlukan' });
  }
  
  const cleanHash = hash.startsWith('0x') ? hash.substring(2) : hash;
  
  res.json({
    success: true,
    message: 'Hash berhasil dipersiapkan',
    hash: cleanHash
  });
});

// Endpoint find document (simplified)
app.get('/api/find-document/:hash', (req, res) => {
  const searchHash = req.params.hash;
  const cleanSearchHash = searchHash.startsWith('0x') ? searchHash.substring(2) : searchHash;
  
  // Simplified lookup in hashMapping
  let foundHash = hashMapping[cleanSearchHash] || hashMapping[cleanSearchHash.toLowerCase()];
  
  if (foundHash) {
    res.json({
      success: true,
      hash: foundHash,
      url: `/uploads/${foundHash}.pdf`,
      message: 'Dokumen ditemukan'
    });
  } else {
    res.status(404).json({
      success: false,
      message: 'Dokumen tidak ditemukan'
    });
  }
});

// Add other endpoints as needed...
app.get('/api/files', (req, res) => {
  res.json({
    success: true,
    files: Object.keys(hashMapping),
    message: 'Daftar file tersedia'
  });
});

// Vercel function export
module.exports = app; 