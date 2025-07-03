const fs = require('fs');
const path = require('path');

// Hash dokumen yang ingin dipastikan
const docId = 'testpdf0-mb1bngj9-iqtwov';
const expectedHash = '0x6f21860467656d8d7827cfd78e3e3719b0f91bb06427ed4059acc8d1efeeb8d2';

// Path file proxy
const uploadsDir = path.join(__dirname, 'uploads');
const proxyPath = path.join(uploadsDir, `${docId}.txt`);
const pdfPath = path.join(uploadsDir, `${expectedHash.substring(2)}.pdf`);
const jsonPath = path.join(uploadsDir, `${expectedHash.substring(2)}.json`);

console.log(`Memeriksa file proxy untuk ${docId}...`);

// Periksa apakah file proxy ada
if (fs.existsSync(proxyPath)) {
  // Baca isi file proxy
  const content = fs.readFileSync(proxyPath, 'utf8').trim();
  console.log(`Isi file proxy sekarang: ${content}`);
  
  // Jika isi tidak sesuai dengan yang diharapkan, perbarui
  if (content !== expectedHash) {
    fs.writeFileSync(proxyPath, expectedHash);
    console.log(`✓ File proxy diperbarui dengan hash: ${expectedHash}`);
  } else {
    console.log(`✓ File proxy sudah berisi hash yang benar`);
  }
} else {
  // Jika file proxy tidak ada, buat baru
  fs.writeFileSync(proxyPath, expectedHash);
  console.log(`✓ File proxy dibuat dengan hash: ${expectedHash}`);
}

// Periksa file PDF dan metadata
console.log(`\nMemeriksa file dokumen dan metadata...`);
console.log(`PDF exists: ${fs.existsSync(pdfPath)} (${pdfPath})`);
console.log(`Metadata exists: ${fs.existsSync(jsonPath)} (${jsonPath})`);

// Update hash mapping
let hashMapping = {};
try {
  if (fs.existsSync('./hash-mapping.json')) {
    const mappingData = fs.readFileSync('./hash-mapping.json', 'utf8');
    hashMapping = JSON.parse(mappingData);
  }
} catch (error) {
  console.error('Error membaca hash-mapping.json:', error);
}

// Update mapping
hashMapping[docId] = expectedHash;
hashMapping[expectedHash.substring(2)] = expectedHash;
hashMapping[expectedHash] = expectedHash;

// Simpan kembali mapping
fs.writeFileSync('./hash-mapping.json', JSON.stringify(hashMapping, null, 2));
console.log(`\n✓ hash-mapping.json diperbarui dengan mapping untuk ${docId}`);

console.log('\nPerubahan selesai! Silakan restart server QR untuk menerapkan perubahan.'); 