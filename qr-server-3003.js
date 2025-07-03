const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3003; // Port untuk QR server sesuai dengan link QR code

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

// Root endpoint
app.get('/', (req, res) => {
  res.send(`
    <h1>QR Code Server</h1>
    <p>Server berjalan di port ${PORT}</p>
    <p>Contoh: <a href="/certificate/testpdf0-mb1aq64h-idgfms">/certificate/testpdf0-mb1aq64h-idgfms</a></p>
  `);
});

// Endpoint QR Code (yang terlihat di URL QR)
app.get('/certificate/:docId', (req, res) => {
  const docId = req.params.docId;
  console.log(`QR Code scan untuk ${docId}`);
  
  const fileHash = getFileHashFromDocId(docId);
  
  if (fileHash) {
    const pdfPath = path.join(__dirname, 'uploads', `${fileHash}.pdf`);
    const metaPath = path.join(__dirname, 'uploads', `${fileHash}.json`);
    
    console.log(`Memeriksa PDF: ${pdfPath}`);
    console.log(`PDF exists: ${fs.existsSync(pdfPath)}`);
    
    if (fs.existsSync(pdfPath)) {
      console.log(`Menampilkan halaman sertifikat untuk ${docId}`);
      
      // Baca metadata jika ada
      let metadata = {};
      if (fs.existsSync(metaPath)) {
        try {
          metadata = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        } catch (e) {
          console.error('Error membaca metadata:', e);
        }
      }
      
      // Kirim halaman HTML dengan PDF viewer
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Certificate - ${docId}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 0;
              background-color: #f5f5f5;
            }
            .container {
              max-width: 1200px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background-color: #2c3e50;
              color: white;
              padding: 20px;
              text-align: center;
              margin-bottom: 20px;
            }
            .metadata {
              background-color: white;
              padding: 20px;
              margin-bottom: 20px;
              border-radius: 8px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .metadata h3 {
              margin-top: 0;
              color: #2c3e50;
            }
            .metadata-item {
              margin: 10px 0;
              padding: 10px;
              background-color: #f9f9f9;
              border-radius: 4px;
            }
            .metadata-label {
              font-weight: bold;
              color: #666;
            }
            .pdf-viewer {
              width: 100%;
              height: 800px;
              border: 1px solid #ddd;
              border-radius: 8px;
              background-color: white;
            }
            .download-btn {
              display: inline-block;
              padding: 10px 20px;
              background-color: #3498db;
              color: white;
              text-decoration: none;
              border-radius: 4px;
              margin-top: 10px;
            }
            .download-btn:hover {
              background-color: #2980b9;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Digital Certificate</h1>
            <p>Document ID: ${docId}</p>
          </div>
          
          <div class="container">
            <div class="metadata">
              <h3>Certificate Information</h3>
              ${metadata.fileName ? `<div class="metadata-item"><span class="metadata-label">File Name:</span> ${metadata.fileName}</div>` : ''}
              ${metadata.signer ? `<div class="metadata-item"><span class="metadata-label">Signer:</span> ${metadata.signer}</div>` : ''}
              ${metadata.timestamp ? `<div class="metadata-item"><span class="metadata-label">Timestamp:</span> ${new Date(metadata.timestamp).toLocaleString()}</div>` : ''}
              ${metadata.txHash ? `<div class="metadata-item"><span class="metadata-label">Transaction Hash:</span> ${metadata.txHash}</div>` : ''}
              <div class="metadata-item"><span class="metadata-label">File Hash:</span> ${fileHash}</div>
              <a href="/uploads/${fileHash}.pdf" class="download-btn" download>Download PDF</a>
            </div>
            
            <iframe src="/uploads/${fileHash}.pdf" class="pdf-viewer"></iframe>
          </div>
        </body>
        </html>
      `);
    } else {
      console.log(`File PDF tidak ditemukan: ${pdfPath}`);
      res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Error - File Not Found</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              background-color: #f5f5f5;
            }
            .error-container {
              text-align: center;
              padding: 40px;
              background-color: white;
              border-radius: 8px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            h1 {
              color: #e74c3c;
            }
          </style>
        </head>
        <body>
          <div class="error-container">
            <h1>File Not Found</h1>
            <p>PDF file tidak ditemukan untuk ID: ${docId}</p>
            <p>File Hash: ${fileHash}</p>
          </div>
        </body>
        </html>
      `);
    }
  } else {
    console.log(`Dokumen tidak ditemukan untuk ID: ${docId}`);
    res.status(404).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Error - Document Not Found</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            background-color: #f5f5f5;
          }
          .error-container {
            text-align: center;
            padding: 40px;
            background-color: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          h1 {
            color: #e74c3c;
          }
        </style>
      </head>
      <body>
        <div class="error-container">
          <h1>Dokumen Tidak Ditemukan</h1>
          <p>Metadata tidak ditemukan untuk ID: ${docId}</p>
        </div>
      </body>
      </html>
    `);
  }
});

// Endpoint untuk verifikasi QR Code (API)
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
  console.log(`Coba scan QR ke URL: http://localhost:${PORT}/certificate/testpdf0-mb1aq64h-idgfms`);
}); 