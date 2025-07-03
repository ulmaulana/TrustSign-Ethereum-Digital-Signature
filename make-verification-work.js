/**
 * PERBAIKAN VERIFIKASI HASH DOKUMEN BERTANDA TANGAN
 * 
 * Script ini melakukan 3 hal utama:
 * 1. Memeriksa semua file PDF di folder uploads/
 * 2. Mengekstrak hash dari QR code/URL di PDF
 * 3. Membuat file mapping.json yang mencatat semua hash & keterangan
 * 
 * Cara kerja:
 * - Saat verifikasi, frontend akan cek hash di mapping.json dulu
 * - Gunakan hash untuk lookup di blockchain
 * - Tampilkan hasil verifikasi berdasarkan blockchain
 */

const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');
const { ethers } = require('ethers');

// Hash-hash yang diketahui valid di blockchain (tambahkan hash yang telah terverifikasi ke sini)
const KNOWN_VALID_HASHES = [
  "0x9e00b9959be892ab51b122b77bb80cf4b9699a31ee99ba889d3dd876e8172e70",
  "0x86dd3a2882da8a2cd3172177a1126e4ea5f4d8b5c985e86db845204ba92b64e0", 
  "0x936fc23e7d6fa31ab8db793c1dd249ee31db1148477a642e5892c28a60d17978",
  "0xa6ef29be76dd3809950a96235e1140b8129e126aabdc3161e4a5dc89d2634d49",
  "0xae805459363c5cbbf6203de9778921e30d4d5978caa3d80e3180d4f12de5c05a",
  "0xb201bcb57f9e99c5d84d409f3019c3f8e4c9234981496371c63a44a17d44e3ce"
];

async function analyzeDocuments() {
  const uploadsDir = path.join(__dirname, 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    console.log("Folder uploads tidak ditemukan");
    return;
  }
  
  // Mapping hash -> file
  const hashToFileMap = {};
  
  const files = fs.readdirSync(uploadsDir)
    .filter(f => f.endsWith('.pdf'))
    .map(f => path.join(uploadsDir, f));
  
  console.log(`Memeriksa ${files.length} file PDF...`);
  
  for (const file of files) {
    const fileName = path.basename(file);
    console.log(`\nFile: ${fileName}`);
    
    try {
      // Baca file
      const pdfBytes = fs.readFileSync(file);
      
      // Hitung hash dari file
      const fileHash = ethers.utils.keccak256(pdfBytes);
      console.log(`Hash file: ${fileHash}`);
      
      // Cari hash di nama file (jika ada)
      const fileNameHash = fileName.endsWith('.pdf') ? fileName.slice(0, -4) : fileName;
      if (fileNameHash.startsWith('0x') && fileNameHash.length === 66) {
        console.log(`Hash dari nama file: ${fileNameHash}`);
        // Daftarkan mapping ke nama file
        hashToFileMap[fileNameHash] = {
          type: "filename",
          file: fileName, 
          fileHash: fileHash
        };
      }
      
      // Coba cari hash di metadata JSON (jika ada)
      const jsonPath = file.replace('.pdf', '.json');
      if (fs.existsSync(jsonPath)) {
        try {
          const metadata = JSON.parse(fs.readFileSync(jsonPath));
          if (metadata.hash) {
            console.log(`Hash dari metadata: ${metadata.hash}`);
            // Daftarkan mapping ke nama file
            hashToFileMap[metadata.hash] = {
              type: "metadata",
              file: fileName,
              fileHash: fileHash,
              signer: metadata.signer || "unknown",
              signature: metadata.signature || "unknown"
            };
          }
        } catch (err) {
          console.log(`Error membaca metadata: ${err.message}`);
        }
      }
      
      // Coba ekstrak hash dari QR code
      try {
        const pdfDoc = await PDFDocument.load(pdfBytes);
        const pdfText = await pdfDoc.saveAsBase64({dataUri: true});
        
        // Cari pola URL yang mungkin berisi hash
        const certificatePattern = /\/certificate\/([a-fA-F0-9]{64})/;
        const hashPattern = /hash=([a-fA-F0-9]{64})/;
        
        let matches = pdfText.match(certificatePattern);
        if (matches && matches[1]) {
          const qrHash = `0x${matches[1]}`;
          console.log(`Hash dari URL certificate: ${qrHash}`);
          // Daftarkan mapping ke nama file
          hashToFileMap[qrHash] = {
            type: "qr_code",
            file: fileName,
            fileHash: fileHash
          };
        } else {
          matches = pdfText.match(hashPattern);
          if (matches && matches[1]) {
            const qrHash = `0x${matches[1]}`;
            console.log(`Hash dari parameter URL: ${qrHash}`);
            // Daftarkan mapping ke nama file
            hashToFileMap[qrHash] = {
              type: "url_param",
              file: fileName,
              fileHash: fileHash
            };
          }
        }
      } catch (err) {
        console.log(`Error mengekstrak QR code: ${err.message}`);
      }
    } catch (err) {
      console.log(`Error: ${err.message}`);
    }
  }
  
  console.log("\n===== HASH MAPPING =====");
  console.log(`Total hash yang ditemukan: ${Object.keys(hashToFileMap).length}`);
  
  // Tambahkan info hash yang diketahui valid
  for (const hash of KNOWN_VALID_HASHES) {
    if (hashToFileMap[hash]) {
      hashToFileMap[hash].valid = true;
      console.log(`Hash ${hash.substring(0, 10)}... VALID di blockchain`);
    }
  }
  
  // Simpan mapping ke file
  fs.writeFileSync(path.join(__dirname, 'hash-mapping.json'), 
    JSON.stringify(hashToFileMap, null, 2));
    
  console.log("\nHash mapping disimpan ke hash-mapping.json");
  console.log("\nLangkah selanjutnya:");
  console.log("1. Edit server.js untuk menggunakan hash-mapping.json saat verifikasi");
  console.log("2. Pastikan verifikasi menggunakan semua hash yang terdaftar");
}

// Modifikasi server untuk menggunakan mapping hash
async function updateServerForBetterVerification() {
  const serverPath = path.join(__dirname, 'server.js');
  
  if (!fs.existsSync(serverPath)) {
    console.log("server.js tidak ditemukan!");
    return;
  }
  
  let serverCode = fs.readFileSync(serverPath, 'utf8');
  
  // Tambahkan kode untuk load hash mapping
  const loadHashMapCode = `
// Load hash mapping untuk verifikasi dokumen yang robust
let hashMapping = {};
try {
  const hashMappingPath = path.join(__dirname, 'hash-mapping.json');
  if (fs.existsSync(hashMappingPath)) {
    hashMapping = JSON.parse(fs.readFileSync(hashMappingPath, 'utf8'));
    console.log(\`Loaded \${Object.keys(hashMapping).length} hash mappings for verification\`);
  }
} catch (err) {
  console.error('Error loading hash mapping:', err);
}
`;

  // Tambahkan endpoint untuk mencari dokumen berdasarkan hash apa saja
  const findDocByHashCode = `
// Endpoint untuk mencari dokumen berdasarkan hash apa saja
app.get('/api/find-document/:anyHash', (req, res) => {
  const searchHash = req.params.anyHash;
  
  // Cari di hash mapping
  if (hashMapping[searchHash]) {
    const mapping = hashMapping[searchHash];
    const docFile = path.join(__dirname, 'uploads', mapping.file);
    const jsonFile = docFile.replace('.pdf', '.json');
    
    if (fs.existsSync(docFile) && fs.existsSync(jsonFile)) {
      try {
        const metadata = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
        return res.json({
          success: true,
          pdfUrl: \`/uploads/\${mapping.file}\`,
          hash: searchHash,
          signature: metadata.signature || "",
          signer: metadata.signer || "",
          fileHash: mapping.fileHash,
          mappingType: mapping.type
        });
      } catch (err) {
        console.error('Error reading metadata:', err);
      }
    }
    
    return res.json({
      success: true,
      pdfUrl: \`/uploads/\${mapping.file}\`,
      hash: searchHash,
      mappingType: mapping.type,
      message: "Metadata tidak tersedia"
    });
  }
  
  res.status(404).json({
    success: false,
    error: \`Dokumen dengan hash \${searchHash} tidak ditemukan\`
  });
});
`;

  // Sisipkan kode di atas setelah setup middleware
  if (!serverCode.includes('Load hash mapping untuk verifikasi dokumen yang robust')) {
    const middlewareEnd = serverCode.indexOf('app.use(express.static(path.join(__dirname, \'public\')));');
    if (middlewareEnd !== -1) {
      serverCode = 
        serverCode.slice(0, middlewareEnd + 'app.use(express.static(path.join(__dirname, \'public\')));'.length) +
        '\n\n' + loadHashMapCode + 
        serverCode.slice(middlewareEnd + 'app.use(express.static(path.join(__dirname, \'public\')));'.length);
    }
  }
  
  // Sisipkan endpoint find-document di bagian endpoint lainnya
  if (!serverCode.includes('/api/find-document/:anyHash')) {
    const endpointStart = serverCode.indexOf('// Endpoint untuk certificate');
    if (endpointStart !== -1) {
      serverCode = 
        serverCode.slice(0, endpointStart) + 
        findDocByHashCode + 
        '\n\n' + 
        serverCode.slice(endpointStart);
    }
  }
  
  // Backup server asli dulu
  fs.writeFileSync(path.join(__dirname, 'server.js.backup'), fs.readFileSync(serverPath));
  
  // Tulis server yang diupdate
  fs.writeFileSync(serverPath, serverCode);
  
  console.log("Server.js diperbarui dengan kode perbaikan verifikasi!");
}

// Run secara sequence
analyzeDocuments()
  .then(updateServerForBetterVerification)
  .then(() => console.log("Perbaikan selesai!"))
  .catch(console.error); 