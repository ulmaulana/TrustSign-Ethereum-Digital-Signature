const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

// CORS Configuration untuk production
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'https://trustsign-ethereum-digital-signatur.vercel.app',
    'https://trustsign-api-backend.vercel.app'
  ],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'TrustSign API Backend is running!',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Mock data untuk demo
const mockDocuments = {
  'testdoc1-mcnuiwop-ks4t10': {
    hash: 'd800bcc2b304b64e34294ddc1000af982a6f828882ecb8233870f37f11cc37dc',
    signature: '0x944c58ce67c8245bfcf4aadba7526c9fcb5b0123abc57a39bbfcb16f9d62e15467890123',
    signer: '0xca01c8c68840cd1c9fdf06f124723a5339224096',
    txHash: '0x4caa53c7574b17e9a821a337851432975adb99716913e1f1dd745915bbbb914c',
    fileName: 'signed_test_doc_1.pdf',
    timestamp: new Date().toISOString(),
    pdfUrl: '/uploads/mock-document.pdf'
  },
  'testdoc3-mco2l94i-rhr0po': {
    hash: 'e123abc456def789012345678901234567890abcdef1234567890abcdef123456',
    signature: '0xabc123def456789012345678901234567890abcdef123456789012345678901234',
    signer: '0xca01c8c68840cd1c9fdf06f124723a5339224096',
    txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    fileName: 'signed_test_doc_3.pdf',
    timestamp: new Date().toISOString(),
    pdfUrl: '/uploads/mock-document-3.pdf'
  }
};

// API endpoint untuk certificate
app.get('/api/certificate/:hash', (req, res) => {
  const hash = req.params.hash;
  console.log('Certificate request for:', hash);
  
  // Cek apakah ada data untuk hash ini
  if (mockDocuments[hash]) {
    console.log('Found mock document for:', hash);
    res.json(mockDocuments[hash]);
  } else {
    console.log('Document not found for:', hash, 'generating mock data...');
    
    // Generate mock data untuk dokumen yang tidak ditemukan
    const mockData = {
      hash: hash.replace(/[^a-z0-9]/gi, '').substring(0, 64) + '123456789abcdef',
      signature: '0x' + 'a'.repeat(130),
      signer: '0xca01c8c68840cd1c9fdf06f124723a5339224096',
      txHash: '0x' + Math.random().toString(16).substring(2, 66),
      fileName: `signed_${hash.substring(0, 10)}.pdf`,
      timestamp: new Date().toISOString(),
      pdfUrl: '/uploads/mock-generated-document.pdf'
    };
    
    // Simpan ke mock documents untuk penggunaan selanjutnya
    mockDocuments[hash] = mockData;
    
    console.log('Generated mock data for:', hash);
    res.json(mockData);
  }
});

// API endpoint untuk recovery
app.get('/api/recover/:hash', (req, res) => {
  const hash = req.params.hash;
  console.log('Recovery request for:', hash);
  
  res.json({
    success: false,
    message: 'Recovery tidak tersedia untuk demo version',
    hash: hash
  });
});

// API endpoint untuk find document
app.get('/api/find-document/:hash', (req, res) => {
  const hash = req.params.hash;
  console.log('Find document request for:', hash);
  
  if (mockDocuments[hash]) {
    res.json({
      hash: mockDocuments[hash].hash,
      pdfUrl: mockDocuments[hash].pdfUrl
    });
  } else {
    // Generate mock data jika tidak ditemukan
    const mockData = {
      hash: hash.replace(/[^a-z0-9]/gi, '').substring(0, 64) + '123456789abcdef',
      pdfUrl: '/uploads/mock-generated-document.pdf'
    };
    
    // Simpan ke mock documents
    if (!mockDocuments[hash]) {
      mockDocuments[hash] = {
        ...mockData,
        signature: '0x' + 'a'.repeat(130),
        signer: '0xca01c8c68840cd1c9fdf06f124723a5339224096',
        txHash: '0x' + Math.random().toString(16).substring(2, 66),
        fileName: `signed_${hash.substring(0, 10)}.pdf`,
        timestamp: new Date().toISOString()
      };
    }
    
    res.json(mockData);
  }
});

// API endpoint untuk tx-hash
app.get('/api/tx-hash/:hash', (req, res) => {
  const hash = req.params.hash;
  console.log('TX hash request for:', hash);
  
  if (mockDocuments[hash]) {
    res.json({
      txHash: mockDocuments[hash].txHash
    });
  } else {
    res.status(404).json({
      error: 'Transaction hash not found',
      hash: hash
    });
  }
});

// API endpoint untuk upload (mock)
app.post('/api/upload-unsigned', (req, res) => {
  console.log('Upload request received (mock)');
  
  res.json({
    success: true,
    message: 'File upload berhasil (demo mode)',
    url: '/uploads/mock-upload.pdf'
  });
});

// API endpoint untuk update signature (mock)
app.post('/api/update-signature', (req, res) => {
  console.log('Update signature request received (mock)');
  
  res.json({
    success: true,
    message: 'Signature updated successfully (demo mode)'
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// 404 handler
app.use((req, res) => {
  console.log('404 - Route not found:', req.path);
  res.status(404).json({
    error: 'Route not found',
    path: req.path,
    method: req.method
  });
});

app.listen(PORT, () => {
  console.log(`TrustSign API Backend (Demo) running on port ${PORT}`);
  console.log('Available endpoints:');
  console.log('- GET / (health check)');
  console.log('- GET /api/certificate/:hash');
  console.log('- GET /api/recover/:hash');
  console.log('- GET /api/find-document/:hash');
  console.log('- GET /api/tx-hash/:hash');
  console.log('- POST /api/upload-unsigned');
  console.log('- POST /api/update-signature');
});

module.exports = app; 