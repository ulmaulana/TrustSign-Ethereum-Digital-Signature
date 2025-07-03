const fs = require('fs');
const path = require('path');

// 1. Cari dan perbaiki file proxy
const uploadsDir = path.join(__dirname, 'uploads');
const docId = 'testpdf0-mb19fmhd-4qhbd6';
const expectedHash = 'e902fb7400c6ae733f49bea872ba05b5bc3ee37992ec0e0704242b20601951cd';

console.log('Membuat ulang file proxy...');

// Buat file proxy baru
const proxyPath = path.join(uploadsDir, `${docId}.txt`);
fs.writeFileSync(proxyPath, expectedHash);
console.log(`File proxy dibuat: ${proxyPath} -> ${expectedHash}`);

// Verifikasi file proxy
const content = fs.readFileSync(proxyPath, 'utf8');
console.log(`Isi file proxy: '${content}'`);
console.log(`Isi file proxy (trim): '${content.trim()}'`);

// 2. Verifikasi file hash
const pdfPath = path.join(uploadsDir, `${expectedHash}.pdf`);
const metaPath = path.join(uploadsDir, `${expectedHash}.json`);

console.log(`\nVerifikasi file hash...`);
console.log(`PDF path: ${pdfPath}`);
console.log(`PDF exists: ${fs.existsSync(pdfPath)}`);
console.log(`Metadata path: ${metaPath}`);
console.log(`Metadata exists: ${fs.existsSync(metaPath)}`);

// 3. Buat metadata baru jika tidak ada
if (!fs.existsSync(metaPath)) {
  console.log(`\nMembuat metadata baru...`);
  
  const metadata = {
    timestamp: new Date().toISOString(),
    fileName: `Document-${expectedHash.substring(0, 8)}`,
    pdfUrl: `/uploads/${expectedHash}.pdf`,
    docIdString: docId,
    status: "signed",
    signature: "",
    signer: ""
  };
  
  fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2));
  console.log(`Metadata baru dibuat: ${metaPath}`);
}

// 4. Update hash-mapping.json
console.log(`\nUpdate hash-mapping.json...`);
let hashMapping = {};

try {
  if (fs.existsSync('./hash-mapping.json')) {
    const mappingData = fs.readFileSync('./hash-mapping.json', 'utf8');
    hashMapping = JSON.parse(mappingData);
    console.log(`Loaded ${Object.keys(hashMapping).length} hash mappings`);
  }
} catch (error) {
  console.error('Error loading hash-mapping.json:', error);
}

// Tambahkan atau update mapping
hashMapping[docId] = expectedHash;
hashMapping[docId.toLowerCase()] = expectedHash;
hashMapping[expectedHash] = expectedHash;

// Simpan mapping
fs.writeFileSync('./hash-mapping.json', JSON.stringify(hashMapping, null, 2));
console.log(`hash-mapping.json updated`);

console.log('\nProses selesai!'); 