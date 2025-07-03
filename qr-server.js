const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3002; // Port untuk QR server

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Fungsi untuk mencari hash file dari docIdString
function getFileHashFromDocId(docId) {
  console.log(`Mencari file untuk docId: ${docId}`);
  
  // 1. Cek file proxy
  const proxyPath = path.join(__dirname, 'uploads', `${docId}.txt`);
  if (fs.existsSync(proxyPath)) {
    try {
      const content = fs.readFileSync(proxyPath, 'utf8').trim();
      console.log(`Ditemukan file proxy: ${docId} -> ${content}`);
      return content;
    } catch (e) {
      console.error(`Error membaca file proxy:`, e);
    }
  }
  
  // 2. Cek hash-mapping.json
  try {
    if (fs.existsSync('./hash-mapping.json')) {
      const mappingData = fs.readFileSync('./hash-mapping.json', 'utf8');
      const hashMapping = JSON.parse(mappingData);
      
      if (hashMapping[docId]) {
        console.log(`Ditemukan di hash mapping: ${docId} -> ${hashMapping[docId]}`);
        return hashMapping[docId];
      }
    }
  } catch (e) {
    console.error(`Error membaca hash-mapping.json:`, e);
  }
  
  // 3. Cek metadata files
  try {
    const uploadsDir = path.join(__dirname, 'uploads');
    const jsonFiles = fs.readdirSync(uploadsDir)
      .filter(file => file.endsWith('.json'));
    
    for (const jsonFile of jsonFiles) {
      try {
        const jsonPath = path.join(uploadsDir, jsonFile);
        const jsonContent = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        
        if (jsonContent.docIdString === docId) {
          const fileHash = jsonFile.replace('.json', '');
          console.log(`Ditemukan di metadata: ${docId} -> ${fileHash}`);
          return fileHash;
        }
      } catch (e) {
        console.error(`Error membaca file JSON ${jsonFile}:`, e);
      }
    }
  } catch (e) {
    console.error(`Error mencari di metadata:`, e);
  }
  
  return null;
}

// Endpoint QR Code (yang terlihat di URL QR)
app.get('/certificate/:docId', (req, res) => {
  const docId = req.params.docId;
  console.log(`QR Code scan untuk ${docId}`);
  
  const fileHash = getFileHashFromDocId(docId);
  
  if (fileHash) {
    const pdfPath = path.join(__dirname, 'uploads', `${fileHash}.pdf`);
    
    if (fs.existsSync(pdfPath)) {
      console.log(`Mengarahkan ke PDF: ${fileHash}.pdf`);
      return res.redirect(`/uploads/${fileHash}.pdf`);
    } else {
      console.log(`File PDF tidak ditemukan: ${pdfPath}`);
      return res.status(404).send(`File PDF tidak ditemukan untuk ID: ${docId}`);
    }
  } else {
    console.log(`Dokumen tidak ditemukan untuk ID: ${docId}`);
    return res.status(404).send(`Dokumen tidak ditemukan untuk ID: ${docId}`);
  }
});

// Endpoint untuk verifikasi QR Code
app.get('/api/verify/:docId', (req, res) => {
  const docId = req.params.docId;
  console.log(`Verifikasi untuk ${docId}`);
  
  const fileHash = getFileHashFromDocId(docId);
  
  if (fileHash) {
    const pdfPath = path.join(__dirname, 'uploads', `${fileHash}.pdf`);
    const metaPath = path.join(__dirname, 'uploads', `${fileHash}.json`);
    
    if (fs.existsSync(pdfPath)) {
      try {
        let metadata = {};
        
        if (fs.existsSync(metaPath)) {
          metadata = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        }
        
        return res.json({
          verified: true,
          docId,
          fileHash,
          pdfUrl: `/uploads/${fileHash}.pdf`,
          metadata
        });
      } catch (e) {
        console.error(`Error membaca metadata:`, e);
        return res.status(500).json({ error: `Error membaca metadata: ${e.message}` });
      }
    } else {
      console.log(`File PDF tidak ditemukan: ${pdfPath}`);
      return res.status(404).json({ error: `File PDF tidak ditemukan untuk ID: ${docId}` });
    }
  } else {
    console.log(`Dokumen tidak ditemukan untuk ID: ${docId}`);
    return res.status(404).json({ error: `Dokumen tidak ditemukan untuk ID: ${docId}` });
  }
});

// Mulai server
app.listen(PORT, () => {
  console.log(`QR Code server berjalan di http://localhost:${PORT}`);
  console.log(`Coba scan QR ke URL: http://localhost:${PORT}/certificate/testpdf0-mb19fmhd-4qhbd6`);
}); 