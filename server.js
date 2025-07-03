const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Simpan file dengan nama hash yang benar
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    // Jika ada hash di body, gunakan sebagai nama file
    if (req.body && req.body.hash) {
      console.log(`Using provided hash for filename: ${req.body.hash}.pdf`);
      cb(null, `${req.body.hash}.pdf`);
    } else {
      // Gunakan nama sementara dengan timestamp untuk menghindari konflik
      const tempName = `temp_${Date.now()}.pdf`;
      console.log(`No hash in body, using temporary filename: ${tempName}`);
      cb(null, tempName);
    }
  }
});

// Filter untuk hanya menerima file PDF
const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Format file tidak didukung! Hanya PDF yang diperbolehkan.'), false);
  }
};

const upload = multer({ 
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Middleware untuk membaca hash sebelum multer memproses
const hashParser = (req, res, next) => {
  if (req.is('multipart/form-data')) {
    const contentType = req.headers['content-type'];
    const boundary = contentType.split('; boundary=')[1];
    
    // Tangkap data mentah
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      // Coba ekstrak hash dari body
      const hashMatch = body.match(/name="hash"\r\n\r\n([0-9a-fA-F]+)/);
      if (hashMatch && hashMatch[1]) {
        // Simpan hash ke request untuk digunakan multer
        req.hashValue = hashMatch[1];
        console.log('Extracted hash from form data:', req.hashValue);
      }
      next();
    });
  } else {
    next();
  }
};

// Endpoint upload
app.post('/api/upload', upload.single('file'), (req, res) => {
  console.log('Received upload request');
  
  // Pastikan folder uploads ada
  const uploadsDir = path.join(__dirname, 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  
  // Verifikasi file ada
  if (!req.file) {
    console.error('No file received');
    return res.status(400).json({ error: 'Tidak ada file yang diterima' });
  }
  
  // Ambil data dari request body
  console.log('Request body after upload:', req.body);
  
  const { hash, signature, signer, txHash } = req.body;
  
  if (!hash || hash === 'undefined') {
    console.error('Hash tidak valid:', hash);
    return res.status(400).json({ error: 'Hash tidak valid' });
  }
  
  // Pastikan hash tidak mengandung 0x di awal
  const cleanHash = hash.startsWith('0x') ? hash.substring(2) : hash;
  
  // Log informasi file
  console.log('File info:', {
    originalname: req.file.originalname,
    filename: req.file.filename,
    path: req.file.path,
    size: req.file.size,
    hash: cleanHash
  });
  
  // File mungkin sudah memiliki nama yang benar dari storage engine
  const currentPath = req.file.path;
  const expectedPath = path.join(__dirname, 'uploads', `${cleanHash}.pdf`);
  
  try {
    // Periksa apakah nama file sudah sesuai dengan hash
    if (currentPath !== expectedPath && fs.existsSync(currentPath)) {
      console.log(`Current path: ${currentPath}`);
      console.log(`Expected path: ${expectedPath}`);
      
      // Jika file dengan nama hash sudah ada, hapus dulu
      if (fs.existsSync(expectedPath)) {
        console.log(`File ${expectedPath} already exists, removing first`);
        fs.unlinkSync(expectedPath);
      }
      
      // Rename file jika belum memiliki nama yang benar
      fs.renameSync(currentPath, expectedPath);
      console.log(`Successfully renamed to ${cleanHash}.pdf`);
    }
    
    // Verifikasi file ada dengan nama hash yang benar
    if (!fs.existsSync(expectedPath)) {
      throw new Error(`File tidak ditemukan: ${expectedPath}`);
    }
    
    // Ambil docIdString jika tersedia
    const docIdString = req.body.docIdString || "";
    
    // Simpan metadata ke file JSON
    const metaPath = path.join(__dirname, 'uploads', `${cleanHash}.json`);
    fs.writeFileSync(metaPath, JSON.stringify({
      signature,
      signer,
      timestamp: new Date().toISOString(),
      fileName: req.file.originalname,
      txHash: txHash || "",
      pdfUrl: `/uploads/${cleanHash}.pdf`,
      uploadedAt: new Date().toISOString(),
      docIdString: docIdString // Tambahkan ID dokumen string
    }, null, 2));
    
    // Jika ada docIdString, tambahkan ke hash-mapping
    if (docIdString) {
      try {
        // Normalize docIdString dan hash untuk pemetaan
        const normalizedDocId = docIdString.toLowerCase();
        const normalizedHash = cleanHash.toLowerCase();
        
        // Update hash-mapping
        hashMapping[normalizedDocId] = normalizedHash;
        hashMapping[normalizedHash] = normalizedHash;
        
        // Simpan hash-mapping yang diperbarui
        fs.writeFileSync('./hash-mapping.json', JSON.stringify(hashMapping, null, 2));
        console.log(`Updated hash-mapping.json with docIdString: ${normalizedDocId} -> ${normalizedHash}`);
      } catch (mapErr) {
        console.error('Error updating hash-mapping:', mapErr);
      }
    }
    
    // Buat salinan cadangan
    const backupPath = path.join(__dirname, 'uploads', 'latest_backup.pdf');
    fs.copyFileSync(expectedPath, backupPath);
    console.log(`Backup copy created at ${backupPath}`);
    
    res.json({
      success: true,
      url: `/uploads/${cleanHash}.pdf`,
      message: 'Dokumen berhasil diunggah'
    });
  } catch (error) {
    console.error('Error processing file:', error);
    return res.status(500).json({ error: 'Gagal menyimpan file: ' + error.message });
  }
});

// Endpoint untuk menerima hash terlebih dahulu
app.post('/api/prepare-hash', express.json(), (req, res) => {
  const { hash, signature, signer, txHash, docIdString, originalHash } = req.body;
  
  console.log('Received prepare-hash request:', {
    hash, 
    signature: signature?.substring(0, 10) + '...',
    signer,
    txHash,
    docIdString: docIdString ? `${docIdString.substring(0, 10)}...` : undefined,
    originalHash: originalHash ? `${originalHash.substring(0, 10)}...` : undefined
  });
  
  if (!hash) {
    return res.status(400).json({ error: 'Hash diperlukan' });
  }
  
  // Simpan ke session atau cache untuk sementara
  const cleanHash = hash.startsWith('0x') ? hash.substring(2) : hash;
  
  // Buat file metadata lebih awal
  const metaPath = path.join(__dirname, 'uploads', `${cleanHash}.json`);
  
  // Jika folder uploads belum ada, buat
  const uploadsDir = path.join(__dirname, 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  
  try {
    fs.writeFileSync(metaPath, JSON.stringify({
      signature,
      signer,
      timestamp: new Date().toISOString(),
      txHash: txHash || "",
      docIdString: docIdString || "", // Tambahkan ID dokumen string
      originalHash: originalHash || "", // Tambahkan hash asli dokumen sebagai metadata
      prepared: true
    }, null, 2));
    
    // Jika ada docIdString, tambahkan ke hash-mapping
    if (docIdString || originalHash) {
      try {
        // Normalize ID dan hash untuk pemetaan
        if (docIdString) {
          const normalizedDocId = docIdString.toLowerCase();
          const normalizedHash = cleanHash.toLowerCase();
          
          // Update hashMapping
          hashMapping[normalizedDocId] = normalizedHash;
        }
        
        // Juga tambahkan original hash jika tersedia
        if (originalHash) {
          const normalizedOrigHash = originalHash.startsWith('0x') ? 
            originalHash.substring(2).toLowerCase() : originalHash.toLowerCase();
          const normalizedHash = cleanHash.toLowerCase();
          
          // Update hashMapping
          hashMapping[normalizedOrigHash] = normalizedHash;
        }
        
        // Tambahkan juga self-mapping
        hashMapping[cleanHash.toLowerCase()] = cleanHash.toLowerCase();
        
        // Simpan hash-mapping yang diperbarui
        fs.writeFileSync('./hash-mapping.json', JSON.stringify(hashMapping, null, 2));
        console.log(`Updated hash-mapping.json with${docIdString ? ' docIdString' : ''}${originalHash ? ' originalHash' : ''}`);
      } catch (mapErr) {
        console.error('Error updating hash-mapping:', mapErr);
      }
    }
    
    console.log(`Prepared metadata saved to ${metaPath}`);
    
    res.json({
      success: true,
      message: 'Hash berhasil dipersiapkan',
      hash: cleanHash
    });
  } catch (error) {
    console.error('Error preparing hash:', error);
    res.status(500).json({ error: 'Gagal menyimpan metadata: ' + error.message });
  }
});

// Load hash-mapping jika ada, dan perbarui dengan metadata dari file-file yang ada
let hashMapping = {};
try {
  if (fs.existsSync('./hash-mapping.json')) {
    const mappingData = fs.readFileSync('./hash-mapping.json', 'utf8');
    try {
      hashMapping = JSON.parse(mappingData);
      console.log(`Loaded ${Object.keys(hashMapping).length} hash mappings`);
      
      // Periksa dan bersihkan nilai yang tidak valid ([object Object])
      let needsCleanup = false;
      for (const [key, value] of Object.entries(hashMapping)) {
        if (typeof value === 'object' || value === '[object Object]') {
          console.log(`Menemukan nilai tidak valid untuk key ${key}: ${value}`);
          delete hashMapping[key];
          needsCleanup = true;
        }
      }
      
      if (needsCleanup) {
        console.log('Membersihkan hash-mapping yang tidak valid');
        fs.writeFileSync('./hash-mapping.json', JSON.stringify(hashMapping, null, 2));
      }
    } catch (jsonError) {
      console.error('Error parsing hash-mapping.json, creating new mapping:', jsonError);
      hashMapping = {};
    }
  }
  
  // Scan folder uploads untuk metadata dan file proxy
  console.log('Scanning uploads folder for metadata and proxy files...');
  const uploadsDir = path.join(__dirname, 'uploads');
  if (fs.existsSync(uploadsDir)) {
    // 1. Periksa file proxy (.txt) terlebih dahulu
    const txtFiles = fs.readdirSync(uploadsDir)
      .filter(file => file.endsWith('.txt') && !file.startsWith('temp_'));
      
    for (const txtFile of txtFiles) {
      try {
        const txtPath = path.join(uploadsDir, txtFile);
        const proxyContent = fs.readFileSync(txtPath, 'utf8').trim();
        
        if (proxyContent) {
          const docId = txtFile.replace('.txt', '');
          
          // Pastikan file asli ada
          const pdfPath = path.join(uploadsDir, `${proxyContent}.pdf`);
          if (fs.existsSync(pdfPath)) {
            console.log(`Found proxy mapping: ${docId} -> ${proxyContent}`);
            
            // Tambahkan ke hash-mapping (pastikan nilai selalu string)
            hashMapping[docId] = proxyContent.toString();
            hashMapping[docId.toLowerCase()] = proxyContent.toString();
          }
        }
      } catch (error) {
        console.error(`Error processing proxy file ${txtFile}:`, error);
      }
    }
    
    // 2. Dapatkan semua file JSON di folder uploads
    const jsonFiles = fs.readdirSync(uploadsDir)
      .filter(file => file.endsWith('.json') && !file.startsWith('temp_'));
    
    for (const jsonFile of jsonFiles) {
      try {
        const jsonPath = path.join(uploadsDir, jsonFile);
        const jsonContent = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        
        // Jika file JSON memiliki docIdString, tambahkan ke mapping
        if (jsonContent.docIdString) {
          const fileHash = jsonFile.replace('.json', '');
          
          // Pastikan file PDF terkait ada
          const pdfPath = path.join(uploadsDir, `${fileHash}.pdf`);
          if (fs.existsSync(pdfPath)) {
            console.log(`Found docIdString mapping: ${jsonContent.docIdString} -> ${fileHash}`);
            
            // Tambahkan ke hash-mapping dalam beberapa variasi
            // Format asli dan lowercase untuk memastikan pencarian berfungsi
            hashMapping[jsonContent.docIdString] = fileHash.toString();
            hashMapping[jsonContent.docIdString.toLowerCase()] = fileHash.toString();
            
            // Cek apakah file proxy sudah ada
            const proxyPath = path.join(uploadsDir, `${jsonContent.docIdString}.txt`);
            if (!fs.existsSync(proxyPath)) {
              // Buat file proxy baru
              try {
                fs.writeFileSync(proxyPath, fileHash);
                console.log(`Created proxy file: ${jsonContent.docIdString}.txt -> ${fileHash}`);
              } catch (err) {
                console.error(`Error creating proxy file for ${jsonContent.docIdString}:`, err);
              }
            }
          }
        }
      } catch (error) {
        console.error(`Error processing JSON file ${jsonFile}:`, error);
      }
    }
    
    // Simpan ulang hash-mapping yang diperbarui
    try {
      fs.writeFileSync('./hash-mapping.json', JSON.stringify(hashMapping, null, 2));
      console.log(`Updated hash-mapping.json with ${Object.keys(hashMapping).length} entries`);
      
      // Tampilkan 5 mapping pertama untuk verifikasi
      let count = 0;
      for (const [key, value] of Object.entries(hashMapping)) {
        if (count < 5) {
          console.log(`Mapping: ${key} -> ${value}`);
          count++;
        }
      }
    } catch (writeError) {
      console.error('Error writing updated hash-mapping.json:', writeError);
    }
  }
} catch (error) {
  console.error('Error loading or updating hash mapping:', error);
  hashMapping = {};
}

// Endpoint baru untuk mencari dokumen berdasarkan hash apa pun (hash bytes32, hash file, atau hash lainnya)
app.get('/api/find-document/:hash', (req, res) => {
  const searchHash = req.params.hash;
  console.log(`Mencari dokumen dengan hash atau docId: ${searchHash}`);
  
  // Bersihkan hash input (hapus 0x jika ada)
  const cleanSearchHash = searchHash.startsWith('0x') ? searchHash.substring(2) : searchHash;
  
  // Variabel untuk menyimpan hasil pencarian
  let foundHash = null;
  let foundInfo = null;
  let foundPath = null;
  let foundMeta = null;
  
  // 1. Periksa di hash-mapping terlebih dahulu (case insensitive)
  if (hashMapping[cleanSearchHash]) {
    foundHash = hashMapping[cleanSearchHash];
    console.log(`Found direct mapping: ${cleanSearchHash} -> ${foundHash}`);
  } else if (hashMapping[cleanSearchHash.toLowerCase()]) {
    foundHash = hashMapping[cleanSearchHash.toLowerCase()];
    console.log(`Found case-insensitive mapping: ${cleanSearchHash} -> ${foundHash}`);
  }
  
  // 2. Cek proxy file docIdString.txt jika tidak ada di mapping
  if (!foundHash) {
    const proxyPath = path.join(__dirname, 'uploads', `${cleanSearchHash}.txt`);
    if (fs.existsSync(proxyPath)) {
      try {
        // Baca isi file proxy (berisi hash file asli)
        const proxyContent = fs.readFileSync(proxyPath, 'utf8').trim();
        if (proxyContent) {
          foundHash = proxyContent;
          console.log(`Found proxy file for ${cleanSearchHash} -> ${foundHash}`);
          
          // Update hash-mapping juga untuk penggunaan di masa depan
          hashMapping[cleanSearchHash] = foundHash;
          hashMapping[cleanSearchHash.toLowerCase()] = foundHash;
          try {
            fs.writeFileSync('./hash-mapping.json', JSON.stringify(hashMapping, null, 2));
            console.log(`Updated hash-mapping with proxy data`);
          } catch (e) {
            console.error('Error updating hash-mapping.json:', e);
          }
        }
      } catch (err) {
        console.error(`Error reading proxy file ${proxyPath}:`, err);
      }
    }
  }
  
  if (foundHash) {
    const pdfPath = path.join(__dirname, 'uploads', `${foundHash}.pdf`);
    const metaPath = path.join(__dirname, 'uploads', `${foundHash}.json`);
    
    if (fs.existsSync(pdfPath) && fs.existsSync(metaPath)) {
      foundPath = pdfPath;
      try {
        foundMeta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        console.log(`Found files via hash-mapping or proxy: ${pdfPath}`);
      } catch (err) {
        console.error(`Error reading metadata for ${metaPath}:`, err);
      }
    } else {
      console.log(`Files referenced in mapping do not exist: ${pdfPath}`);
      foundHash = null;  // Reset jika file tidak ditemukan
    }
  }
  
  // 3. Jika tidak ditemukan, cari di file metadata untuk docIdString yang cocok
  if (!foundHash) {
    console.log(`Searching for docIdString ${cleanSearchHash} in metadata files`);
    try {
      const jsonFiles = fs.readdirSync(path.join(__dirname, 'uploads'))
        .filter(file => file.endsWith('.json'));
      
      for (const jsonFile of jsonFiles) {
        try {
          const jsonPath = path.join(__dirname, 'uploads', jsonFile);
          const jsonContent = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
          
          // Cek docIdString (case-insensitive)
          if (jsonContent.docIdString && 
             (jsonContent.docIdString === cleanSearchHash || 
              jsonContent.docIdString.toLowerCase() === cleanSearchHash.toLowerCase())) {
            
            console.log(`Found matching docIdString in ${jsonFile}`);
            const fileHash = jsonFile.replace('.json', '');
            const pdfPath = path.join(__dirname, 'uploads', `${fileHash}.pdf`);
            
            if (fs.existsSync(pdfPath)) {
              console.log(`Found PDF file: ${pdfPath}`);
              foundHash = fileHash;
              foundPath = pdfPath;
              foundMeta = jsonContent;
              
              // Buat proxy file untuk docIdString
              try {
                const proxyPath = path.join(__dirname, 'uploads', `${cleanSearchHash}.txt`);
                fs.writeFileSync(proxyPath, fileHash);
                console.log(`Created proxy file ${cleanSearchHash}.txt -> ${fileHash}`);
              } catch (e) {
                console.error('Error creating proxy file:', e);
              }
              
              // Update hash-mapping
              hashMapping[cleanSearchHash] = fileHash;
              hashMapping[cleanSearchHash.toLowerCase()] = fileHash;
              try {
                fs.writeFileSync('./hash-mapping.json', JSON.stringify(hashMapping, null, 2));
                console.log(`Updated hash-mapping.json with new mapping: ${cleanSearchHash} -> ${fileHash}`);
              } catch (e) {
                console.error('Error updating hash-mapping.json:', e);
              }
              
              break;
            }
          }
        } catch (err) {
          console.error(`Error reading metadata ${jsonFile}:`, err);
        }
      }
    } catch (err) {
      console.error('Error reading uploads directory:', err);
    }
  }
  
  // 4. Jika masih tidak ditemukan, coba langsung lookup file PDF dengan nama hash
  if (!foundHash) {
    console.log(`Attempting direct file lookup for ${cleanSearchHash}`);
    const directPath = path.join(__dirname, 'uploads', `${cleanSearchHash}.pdf`);
    const metaPath = path.join(__dirname, 'uploads', `${cleanSearchHash}.json`);
    
    if (fs.existsSync(directPath) && fs.existsSync(metaPath)) {
      console.log(`Found exact match: ${cleanSearchHash}.pdf`);
      foundHash = cleanSearchHash;
      foundPath = directPath;
      
      try {
        foundMeta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      } catch (err) {
        console.error(`Error reading metadata for ${metaPath}:`, err);
      }
    }
  }
  
  // 5. Cek file-file dengan kecocokan parsial
  if (!foundHash) {
    console.log(`Checking for partial hash matches for: ${cleanSearchHash}`);
    try {
      const allFiles = fs.readdirSync(path.join(__dirname, 'uploads'));
      const pdfMatches = allFiles.filter(file => 
        file.toLowerCase().includes(cleanSearchHash.toLowerCase()) && file.endsWith('.pdf')
      );
      
      if (pdfMatches.length > 0) {
        const matchedPdfName = pdfMatches[0];
        const fileHash = matchedPdfName.replace('.pdf', '');
        const metaPath = path.join(__dirname, 'uploads', `${fileHash}.json`);
        
        console.log(`Found partial match: ${matchedPdfName}`);
        
        foundHash = fileHash;
        foundPath = path.join(__dirname, 'uploads', matchedPdfName);
        
        if (fs.existsSync(metaPath)) {
          try {
            foundMeta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
          } catch (err) {
            console.error(`Error reading metadata for ${metaPath}:`, err);
          }
        }
      }
    } catch (err) {
      console.error('Error checking partial matches:', err);
    }
  }
  
  if (foundHash) {
    console.log(`Found document with hash: ${foundHash}`);
    
    // Buat response dengan metadata yang ada
    foundInfo = {
      hash: foundHash,
      pdfUrl: `/uploads/${foundHash}.pdf`
    };
    
    // Tambahkan metadata jika ada
    if (foundMeta) {
      foundInfo = {
        ...foundInfo,
        signature: foundMeta.signature || "",
        signer: foundMeta.signer || "",
        timestamp: foundMeta.timestamp || "",
        fileName: foundMeta.fileName || "",
        docIdString: foundMeta.docIdString || "",
        txHash: foundMeta.txHash || "",
        status: foundMeta.status || "signed",
        blockNumber: foundMeta.blockNumber || "",
        signedAt: foundMeta.signedAt || foundMeta.timestamp || ""
      };
    }
  } else {
    console.log(`No document found with hash: ${cleanSearchHash}`);
    foundInfo = {
      error: 'Dokumen tidak ditemukan',
      canRecover: false
    };
  }
  
  res.json(foundInfo);
});

// Endpoint upload-unsigned untuk file tanpa tanda tangan (hanya QR)
app.post('/api/upload-unsigned', upload.single('file'), (req, res) => {
  console.log('Received upload-unsigned request');
  
  // Pastikan folder uploads ada
  const uploadsDir = path.join(__dirname, 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  
  // Verifikasi file ada
  if (!req.file) {
    console.error('No file received');
    return res.status(400).json({ error: 'Tidak ada file yang diterima' });
  }
  
  // Ambil data dari request body
  console.log('Request body after upload:', req.body);
  
  const { fileHash, docIdString } = req.body;
  
  if (!fileHash) {
    console.error('Hash file tidak valid:', fileHash);
    return res.status(400).json({ error: 'Hash file tidak valid' });
  }
  
  if (!docIdString) {
    console.warn('Warning: docIdString tidak ada dalam request');
  }
  
  // Pastikan hash tidak mengandung 0x di awal
  const cleanHash = fileHash.startsWith('0x') ? fileHash.substring(2) : fileHash;
  console.log('Clean hash untuk penyimpanan:', cleanHash);
  
  // Log informasi file
  console.log('File info:', {
    originalname: req.file.originalname,
    filename: req.file.filename,
    path: req.file.path,
    size: req.file.size,
    fileHash: cleanHash,
    docIdString
  });
  
  // File mungkin sudah memiliki nama yang benar dari storage engine
  const currentPath = req.file.path;
  const expectedPath = path.join(__dirname, 'uploads', `${cleanHash}.pdf`);
  
  try {
    // Periksa apakah nama file sudah sesuai dengan hash
    if (currentPath !== expectedPath && fs.existsSync(currentPath)) {
      console.log(`Current path: ${currentPath}`);
      console.log(`Expected path: ${expectedPath}`);
      
      // Jika file dengan nama hash sudah ada, hapus dulu
      if (fs.existsSync(expectedPath)) {
        console.log(`File ${expectedPath} already exists, removing first`);
        fs.unlinkSync(expectedPath);
      }
      
      // Rename file jika belum memiliki nama yang benar
      fs.renameSync(currentPath, expectedPath);
      console.log(`Successfully renamed to ${cleanHash}.pdf`);
    }
    
    // Verifikasi file ada dengan nama hash yang benar
    if (!fs.existsSync(expectedPath)) {
      throw new Error(`File tidak ditemukan: ${expectedPath}`);
    }
    
    // Simpan metadata ke file JSON (tanpa tanda tangan dulu)
    const metaPath = path.join(__dirname, 'uploads', `${cleanHash}.json`);
    fs.writeFileSync(metaPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      fileName: req.file.originalname,
      pdfUrl: `/uploads/${cleanHash}.pdf`,
      uploadedAt: new Date().toISOString(),
      docIdString: docIdString || "", // Tambahkan ID dokumen string
      status: "uploaded", // Status: belum ditandatangani
      signature: "",
      signer: ""
    }, null, 2));
    
    // Tambahkan ke hash-mapping
    if (docIdString) {
      try {
        // Normalize ID dan hash untuk pemetaan
        // Simpan mapping dalam kedua format (docIdString -> hash dan lowercase docIdString -> hash)
        // untuk memastikan bisa dicari dengan case-insensitive
        hashMapping[docIdString] = cleanHash;
        hashMapping[docIdString.toLowerCase()] = cleanHash;
        hashMapping[cleanHash.toLowerCase()] = cleanHash;
        
        // Simpan hash-mapping yang diperbarui
        fs.writeFileSync('./hash-mapping.json', JSON.stringify(hashMapping, null, 2));
        console.log(`Updated hash-mapping.json with docIdString: ${docIdString} -> ${cleanHash}`);
        
        // Buat file proxy untuk docIdString
        const proxyPath = path.join(__dirname, 'uploads', `${docIdString}.txt`);
        if (!fs.existsSync(proxyPath)) {
          fs.writeFileSync(proxyPath, cleanHash);
          console.log(`Created proxy file: ${docIdString}.txt -> ${cleanHash}`);
        }
      } catch (mapErr) {
        console.error('Error updating hash-mapping:', mapErr);
      }
    }
    
    // Buat salinan cadangan
    const backupPath = path.join(__dirname, 'uploads', 'latest_backup.pdf');
    fs.copyFileSync(expectedPath, backupPath);
    console.log(`Backup copy created at ${backupPath}`);
    
    res.json({
      success: true,
      url: `/uploads/${cleanHash}.pdf`,
      hash: cleanHash,
      docIdString: docIdString,
      message: 'Dokumen berhasil diunggah, siap untuk ditandatangani'
    });
  } catch (error) {
    console.error('Error processing file:', error);
    return res.status(500).json({ error: 'Gagal menyimpan file: ' + error.message });
  }
});

// Endpoint untuk update metadata dengan informasi tanda tangan
app.post('/api/update-signature', express.json(), (req, res) => {
  const { fileHash, docIdString, signature, signer, txHash } = req.body;
  
  console.log('Received update-signature request:', {
    fileHash,
    docIdString: docIdString?.substring(0, 15) + '...',
    signature: signature?.substring(0, 15) + '...',
    signer,
    txHash
  });
  
  if (!fileHash) {
    return res.status(400).json({ error: 'Hash file diperlukan' });
  }
  
  // Pastikan hash tidak mengandung 0x di awal
  const cleanHash = fileHash.startsWith('0x') ? fileHash.substring(2) : fileHash;
  const metaPath = path.join(__dirname, 'uploads', `${cleanHash}.json`);
  
  try {
    // Periksa apakah file metadata ada
    if (!fs.existsSync(metaPath)) {
      return res.status(404).json({ error: 'Metadata dokumen tidak ditemukan' });
    }
    
    // Baca metadata yang ada
    const currentMeta = JSON.parse(fs.readFileSync(metaPath));
    
    // Update dengan informasi tanda tangan
    const updatedMeta = {
      ...currentMeta,
      signature,
      signer,
      txHash: txHash || "",
      status: "signed", // Update status jadi sudah ditandatangani
      signedAt: new Date().toISOString()
    };
    
    // Simpan metadata yang diupdate
    fs.writeFileSync(metaPath, JSON.stringify(updatedMeta, null, 2));
    console.log(`Signature metadata updated for ${cleanHash}`);
    
    // Jika ada docIdString, pastikan hash-mapping diperbarui
    if (docIdString) {
      hashMapping[docIdString] = cleanHash.toString();
      hashMapping[docIdString.toLowerCase()] = cleanHash.toString();
      
      // Juga perbarui file proxy
      const proxyPath = path.join(__dirname, 'uploads', `${docIdString}.txt`);
      if (!fs.existsSync(proxyPath)) {
        try {
          fs.writeFileSync(proxyPath, cleanHash);
          console.log(`Created proxy file: ${docIdString}.txt -> ${cleanHash}`);
        } catch (err) {
          console.error(`Error creating proxy file for ${docIdString}:`, err);
        }
      }
      
      // Simpan mapping yang diperbarui
      try {
        fs.writeFileSync('./hash-mapping.json', JSON.stringify(hashMapping, null, 2));
        console.log(`Updated hash-mapping for signature: ${docIdString} -> ${cleanHash}`);
      } catch (e) {
        console.error('Error updating hash-mapping.json:', e);
      }
    }
    
    res.json({ 
      success: true, 
      message: 'Metadata tanda tangan berhasil diperbarui' 
    });
  } catch (error) {
    console.error('Error updating signature:', error);
    res.status(500).json({ error: 'Gagal memperbarui metadata tanda tangan: ' + error.message });
  }
});

// Endpoint get certificate by hash
app.get('/api/certificate/:hash', async (req, res) => {
  const hash = req.params.hash;
  console.log(`Request for certificate with hash or docId: ${hash}`);
  
  // Mencetak semua entry dalam hash mapping
  console.log("DEBUGGING: Hash Mapping Entries:");
  Object.entries(hashMapping).forEach(([key, value]) => {
    console.log(`  ${key} -> ${value}`);
  });
  
  // Gunakan fungsi internal untuk mencari dokumen
  // untuk mencegah duplikasi kode dengan endpoint /api/find-document
  try {
    // Cari hash file yang asli terlebih dahulu
    let actualHash = null;
    let targetFile = null;
    
    // Coba cari dengan hash mapping
    if (hashMapping[hash]) {
      actualHash = hashMapping[hash];
      console.log(`Found in hash mapping: ${hash} -> ${actualHash}`);
    } else if (hashMapping[hash.toLowerCase()]) {
      actualHash = hashMapping[hash.toLowerCase()];
      console.log(`Found in hash mapping (lowercase): ${hash} -> ${actualHash}`);
    }
    
    // Coba cari dengan file proxy
    if (!actualHash) {
      const proxyPath = path.join(__dirname, 'uploads', `${hash}.txt`);
      console.log(`Checking proxy file at: ${proxyPath}`);
      if (fs.existsSync(proxyPath)) {
        try {
          const content = fs.readFileSync(proxyPath, 'utf8').trim();
          console.log(`DEBUG: Proxy file content: '${content}'`);
          
          // Remove trailing whitespace
          actualHash = content.trim();
          console.log(`Found in proxy file: ${hash} -> ${actualHash}`);
        } catch (e) {
          console.error(`Error reading proxy file: ${e.message}`);
        }
      } else {
        console.log(`Proxy file does not exist: ${proxyPath}`);
      }
    }
    
    // Jika masih tidak ditemukan, periksa metadata file
    if (!actualHash) {
      console.log(`Searching in metadata files...`);
      const uploadsDir = path.join(__dirname, 'uploads');
      const jsonFiles = fs.readdirSync(uploadsDir)
        .filter(file => file.endsWith('.json'));
      
      console.log(`Found ${jsonFiles.length} JSON files`);
      
      for (const jsonFile of jsonFiles) {
        try {
          const jsonPath = path.join(uploadsDir, jsonFile);
          const jsonContent = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
          
          console.log(`Checking ${jsonFile} for docIdString '${hash}'...`);
          if (jsonContent.docIdString) {
            console.log(`  Found docIdString: '${jsonContent.docIdString}'`);
          }
          
          if (jsonContent.docIdString === hash) {
            actualHash = jsonFile.replace('.json', '');
            console.log(`Found in metadata: ${hash} -> ${actualHash}`);
            break;
          }
        } catch (e) {
          console.error(`Error reading JSON file ${jsonFile}: ${e.message}`);
        }
      }
    }
    
    // Jika masih tidak ditemukan, gunakan hash asli
    if (!actualHash) {
      actualHash = hash;
      console.log(`Using original hash: ${hash}`);
    }
    
    // Tentukan path file
    const pdfPath = path.join(__dirname, 'uploads', `${actualHash}.pdf`);
    const metaPath = path.join(__dirname, 'uploads', `${actualHash}.json`);
    
    console.log(`PDF path: ${pdfPath}`);
    console.log(`Metadata path: ${metaPath}`);
    
    // Periksa apakah file PDF ada
    if (!fs.existsSync(pdfPath)) {
      console.log(`PDF file not found: ${pdfPath}`);
      console.log(`Listing directory contents...`);
      fs.readdirSync(path.join(__dirname, 'uploads'))
        .filter(file => file.includes(actualHash.substring(0, 10)))
        .forEach(file => {
          console.log(`  Found file: ${file}`);
        });
      
      // Coba gunakan file backup
      const backupPath = path.join(__dirname, 'uploads', 'latest_backup.pdf');
      if (fs.existsSync(backupPath)) {
        try {
          fs.copyFileSync(backupPath, pdfPath);
          console.log(`Created PDF from backup: ${backupPath} -> ${pdfPath}`);
        } catch (e) {
          console.error(`Error copying backup file: ${e.message}`);
          return res.status(404).json({ error: `PDF file not found: ${pdfPath}` });
        }
      } else {
        return res.status(404).json({ error: 'PDF file not found and no backup available' });
      }
    }
    
    // Periksa atau buat metadata
    let metaData = null;
    
    if (fs.existsSync(metaPath)) {
      try {
        metaData = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        console.log(`Found metadata file: ${metaPath}`);
      } catch (e) {
        console.error(`Error reading metadata file: ${e.message}`);
      }
    } else {
      console.log(`Metadata file not found: ${metaPath}`);
      console.log(`Listing directory contents...`);
      fs.readdirSync(path.join(__dirname, 'uploads'))
        .filter(file => file.includes(actualHash.substring(0, 10)))
        .forEach(file => {
          console.log(`  Found file: ${file}`);
        });
    }
    
    // Buat metadata baru jika tidak ada atau error
    if (!metaData) {
      console.log(`Creating new metadata for ${actualHash}`);
      metaData = {
        timestamp: new Date().toISOString(),
        fileName: `Document-${actualHash.substring(0, 8)}`,
        pdfUrl: `/uploads/${actualHash}.pdf`,
        docIdString: hash,
        status: "recovered",
        recovered: true
      };
      
      // Simpan metadata baru
      try {
        fs.writeFileSync(metaPath, JSON.stringify(metaData, null, 2));
        console.log(`Saved new metadata to ${metaPath}`);
      } catch (e) {
        console.error(`Error saving metadata: ${e.message}`);
      }
    }
    
    // Pastikan file proxy ada untuk pencarian di masa depan
    if (hash !== actualHash) {
      const proxyPath = path.join(__dirname, 'uploads', `${hash}.txt`);
      if (!fs.existsSync(proxyPath)) {
        try {
          fs.writeFileSync(proxyPath, actualHash);
          console.log(`Created proxy file: ${hash}.txt -> ${actualHash}`);
          
          // Update hash mapping juga
          hashMapping[hash] = actualHash;
          hashMapping[hash.toLowerCase()] = actualHash;
          fs.writeFileSync('./hash-mapping.json', JSON.stringify(hashMapping, null, 2));
          console.log(`Updated hash mapping with ${hash} -> ${actualHash}`);
        } catch (e) {
          console.error(`Error creating proxy file: ${e.message}`);
        }
      }
    }
    
    // Buat response
    const responseData = {
      pdfUrl: `/uploads/${actualHash}.pdf`,
      signature: metaData.signature || "",
      signer: metaData.signer || "",
      timestamp: metaData.timestamp || new Date().toISOString(),
      fileName: metaData.fileName || `Document-${actualHash.substring(0, 8)}`,
      txHash: metaData.txHash || "",
      docIdString: metaData.docIdString || hash,
      status: metaData.status || "recovered",
      blockNumber: metaData.blockNumber || "",
      signedAt: metaData.signedAt || metaData.timestamp || "",
      recovered: metaData.recovered || false
    };
    
    return res.json(responseData);
  } catch (error) {
    console.error(`Error processing request: ${error.message}`);
    return res.status(500).json({ error: 'Error processing request: ' + error.message });
  }
});

// Endpoint untuk recover dokumen yang hilang
app.get('/api/recover/:hash', (req, res) => {
  const hash = req.params.hash;
  const cleanHash = hash.startsWith('0x') ? hash.substring(2) : hash;
  
  const pdfPath = path.join(__dirname, 'uploads', `${cleanHash}.pdf`);
  const metaPath = path.join(__dirname, 'uploads', `${cleanHash}.json`);
  
  console.log(`Attempting to recover document with hash: ${hash}`);
  
  if (!fs.existsSync(metaPath)) {
    return res.status(404).json({ error: 'Metadata dokumen tidak ditemukan' });
  }
  
  // Cari semua opsi file yang bisa digunakan untuk recovery
  const backupOptions = [
    path.join(__dirname, 'uploads', 'latest_backup.pdf'),
    path.join(__dirname, 'uploads', `backup_${cleanHash}.pdf`),
    path.join(__dirname, 'uploads', 'undefined.pdf')
  ];
  
  // Tambahkan semua file PDF yang tersedia ke opsi
  const pdfFiles = fs.readdirSync(path.join(__dirname, 'uploads'))
    .filter(file => file.endsWith('.pdf') && !file.startsWith('temp_'));
  
  for (const pdfFile of pdfFiles) {
    backupOptions.push(path.join(__dirname, 'uploads', pdfFile));
  }
  
  // Coba semua opsi recovery
  for (const backupPath of backupOptions) {
    if (fs.existsSync(backupPath) && backupPath !== pdfPath) {
      try {
        console.log(`Attempting recovery using ${backupPath}`);
        fs.copyFileSync(backupPath, pdfPath);
        console.log(`Recovery successful using ${backupPath}`);
        
        return res.json({ 
          success: true, 
          message: `Dokumen berhasil direcovery menggunakan ${path.basename(backupPath)}`,
          pdfUrl: `/uploads/${cleanHash}.pdf` 
        });
      } catch (error) {
        console.error(`Error recovering with ${backupPath}:`, error);
      }
    }
  }
  
  return res.status(404).json({ 
    error: 'Tidak ada file PDF yang tersedia untuk recovery',
    availableOptions: backupOptions.filter(p => fs.existsSync(p)).map(p => path.basename(p))
  });
});

// Endpoint untuk mendapatkan transaction hash berdasarkan hash dokumen
app.get('/api/tx-hash/:hash', (req, res) => {
  const hash = req.params.hash;
  const cleanHash = hash.startsWith('0x') ? hash.substring(2) : hash;
  
  // Periksa metadata terlebih dahulu
  const metaPath = path.join(__dirname, 'uploads', `${cleanHash}.json`);
  
  console.log(`Request for txHash with document hash: ${hash}`);
  
  if (fs.existsSync(metaPath)) {
    try {
      const meta = JSON.parse(fs.readFileSync(metaPath));
      
      if (meta.txHash) {
        console.log(`Found txHash in metadata: ${meta.txHash}`);
        return res.json({ 
          txHash: meta.txHash,
          source: 'metadata'
        });
      }
    } catch (error) {
      console.error('Error reading metadata for txHash:', error);
    }
  }
  
  // Jika tidak ada di metadata, kembalikan response kosong
  res.json({ 
    txHash: '',
    source: 'default'
  });
});

// Tambahkan endpoint untuk melihat list file di folder uploads (untuk debugging)
app.get('/api/files', (req, res) => {
  try {
    const uploadsDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      return res.json({ files: [] });
    }
    
    const files = fs.readdirSync(uploadsDir);
    const fileDetails = files.map(file => {
      const filePath = path.join(uploadsDir, file);
      const stats = fs.statSync(filePath);
      return {
        name: file,
        size: stats.size,
        isDirectory: stats.isDirectory(),
        extension: path.extname(file),
        created: stats.birthtime,
        modified: stats.mtime
      };
    });
    
    res.json({ files: fileDetails });
  } catch (error) {
    console.error('Error listing files:', error);
    res.status(500).json({ error: 'Error listing files: ' + error.message });
  }
});

// Endpoint untuk update metadata
app.post('/api/update-metadata', express.json(), (req, res) => {
  const { hash, metadata } = req.body;
  
  if (!hash) {
    return res.status(400).json({ error: 'Hash diperlukan' });
  }
  
  if (!metadata) {
    return res.status(400).json({ error: 'Metadata diperlukan' });
  }
  
  // Pastikan hash tidak mengandung 0x
  const cleanHash = hash.startsWith('0x') ? hash.substring(2) : hash;
  const metaPath = path.join(__dirname, 'uploads', `${cleanHash}.json`);
  
  try {
    // Periksa apakah file metadata ada
    if (!fs.existsSync(metaPath)) {
      return res.status(404).json({ error: 'Metadata tidak ditemukan' });
    }
    
    // Simpan metadata baru
    fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2));
    console.log(`Metadata updated for ${cleanHash}`);
    
    res.json({ success: true, message: 'Metadata berhasil diperbarui' });
  } catch (error) {
    console.error('Error updating metadata:', error);
    res.status(500).json({ error: 'Gagal memperbarui metadata: ' + error.message });
  }
});

// Endpoint proxy view (untuk debugging)
app.get('/api/proxy-view/:docid', (req, res) => {
  const docId = req.params.docid;
  console.log(`Viewing proxy for ${docId}`);
  
  const proxyPath = path.join(__dirname, 'uploads', `${docId}.txt`);
  
  if (fs.existsSync(proxyPath)) {
    try {
      const content = fs.readFileSync(proxyPath, 'utf8');
      const hash = content.trim();
      
      // Cek file terkait
      const pdfPath = path.join(__dirname, 'uploads', `${hash}.pdf`);
      const metaPath = path.join(__dirname, 'uploads', `${hash}.json`);
      
      const pdfExists = fs.existsSync(pdfPath);
      const metaExists = fs.existsSync(metaPath);
      
      res.json({
        docId,
        proxyExists: true,
        proxyContent: content,
        proxyContentTrimmed: hash,
        pdfExists,
        metaExists,
        pdfPath: `/uploads/${hash}.pdf`,
        metaPath: `/uploads/${hash}.json`
      });
    } catch (e) {
      res.status(500).json({ error: `Error reading proxy: ${e.message}` });
    }
  } else {
    res.status(404).json({ error: `Proxy not found for ${docId}` });
  }
});

// Endpoint langsung untuk file PDF via ID dokumen
app.get('/api/proxy/:docid', (req, res) => {
  const docId = req.params.docid;
  console.log(`Direct proxy access for ${docId}`);
  
  const proxyPath = path.join(__dirname, 'uploads', `${docId}.txt`);
  
  if (fs.existsSync(proxyPath)) {
    try {
      const content = fs.readFileSync(proxyPath, 'utf8');
      const hash = content.trim();
      
      // Cek file terkait
      const pdfPath = path.join(__dirname, 'uploads', `${hash}.pdf`);
      
      if (fs.existsSync(pdfPath)) {
        // Redirect ke file PDF
        res.redirect(`/uploads/${hash}.pdf`);
      } else {
        res.status(404).json({ error: `PDF file not found for ${docId}` });
      }
    } catch (e) {
      res.status(500).json({ error: `Error reading proxy: ${e.message}` });
    }
  } else {
    res.status(404).json({ error: `Proxy not found for ${docId}` });
  }
});

// Endpoint untuk QR Code yang terlihat di URL seperti http://localhost:3002/certificate/testpdf0-mb19fmhd-4qhbd6
app.get('/certificate/:hash', (req, res) => {
  const hash = req.params.hash;
  console.log(`Certificate request from QR Code: ${hash}`);
  
  // Cari file proxy untuk hash ini
  const proxyPath = path.join(__dirname, 'uploads', `${hash}.txt`);
  
  if (fs.existsSync(proxyPath)) {
    try {
      // Baca hash asli dari file proxy
      const content = fs.readFileSync(proxyPath, 'utf8');
      const actualHash = content.trim();
      
      // Cek file PDF
      const pdfPath = path.join(__dirname, 'uploads', `${actualHash}.pdf`);
      
      if (fs.existsSync(pdfPath)) {
        // Redirect ke file PDF
        console.log(`Redirecting QR scan to: /uploads/${actualHash}.pdf`);
        return res.redirect(`/uploads/${actualHash}.pdf`);
      } else {
        console.log(`PDF not found for hash: ${actualHash}`);
        return res.status(404).send(`PDF file not found for hash: ${actualHash}`);
      }
    } catch (e) {
      console.error(`Error reading proxy file: ${e.message}`);
      return res.status(500).send(`Error reading proxy file: ${e.message}`);
    }
  } else {
    // Jika tidak ada file proxy, coba cari di metadata
    console.log(`Proxy file not found for ${hash}, searching in metadata...`);
    
    try {
      // Cari di metadata files
      const uploadsDir = path.join(__dirname, 'uploads');
      const jsonFiles = fs.readdirSync(uploadsDir)
        .filter(file => file.endsWith('.json'));
      
      for (const jsonFile of jsonFiles) {
        try {
          const jsonPath = path.join(uploadsDir, jsonFile);
          const jsonContent = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
          
          if (jsonContent.docIdString === hash) {
            // Temukan hash file dari nama file JSON
            const actualHash = jsonFile.replace('.json', '');
            
            // Cek file PDF
            const pdfPath = path.join(uploadsDir, `${actualHash}.pdf`);
            
            if (fs.existsSync(pdfPath)) {
              // Buat file proxy untuk penggunaan di masa depan
              try {
                fs.writeFileSync(proxyPath, actualHash);
                console.log(`Created proxy file: ${hash}.txt -> ${actualHash}`);
              } catch (e) {
                console.error(`Error creating proxy file: ${e.message}`);
              }
              
              // Redirect ke file PDF
              console.log(`Redirecting QR scan to: /uploads/${actualHash}.pdf`);
              return res.redirect(`/uploads/${actualHash}.pdf`);
            } else {
              console.log(`PDF not found for hash: ${actualHash}`);
              return res.status(404).send(`PDF file not found for hash: ${actualHash}`);
            }
          }
        } catch (e) {
          console.error(`Error reading JSON file ${jsonFile}: ${e.message}`);
        }
      }
      
      // Jika tidak ditemukan di metadata
      console.log(`Document not found for hash: ${hash}`);
      return res.status(404).send(`Document not found for hash: ${hash}`);
    } catch (e) {
      console.error(`Error searching metadata: ${e.message}`);
      return res.status(500).send(`Error searching metadata: ${e.message}`);
    }
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});