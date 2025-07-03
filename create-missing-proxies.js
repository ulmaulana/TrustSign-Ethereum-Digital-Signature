const fs = require('fs');
const path = require('path');

console.log('Mencari dan membuat file proxy yang hilang...\n');

const uploadsDir = path.join(__dirname, 'uploads');

// Baca semua file JSON di folder uploads
const jsonFiles = fs.readdirSync(uploadsDir)
  .filter(file => file.endsWith('.json') && !file.startsWith('doc_'));

let createdCount = 0;
let checkedCount = 0;

for (const jsonFile of jsonFiles) {
  try {
    const jsonPath = path.join(uploadsDir, jsonFile);
    const metadata = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    
    checkedCount++;
    
    // Jika ada docIdString dalam metadata
    if (metadata.docIdString) {
      const fileHash = jsonFile.replace('.json', '');
      const proxyPath = path.join(uploadsDir, `${metadata.docIdString}.txt`);
      
      // Cek apakah file proxy sudah ada
      if (!fs.existsSync(proxyPath)) {
        // Buat file proxy
        fs.writeFileSync(proxyPath, fileHash);
        console.log(`✓ Dibuat: ${metadata.docIdString}.txt -> ${fileHash}`);
        createdCount++;
      } else {
        // Verifikasi isi file proxy
        const existingContent = fs.readFileSync(proxyPath, 'utf8').trim();
        if (existingContent !== fileHash) {
          console.log(`⚠ File proxy ${metadata.docIdString}.txt sudah ada tapi isinya berbeda:`);
          console.log(`  Isi sekarang: ${existingContent}`);
          console.log(`  Seharusnya: ${fileHash}`);
        }
      }
    }
  } catch (error) {
    console.error(`Error memproses ${jsonFile}: ${error.message}`);
  }
}

console.log(`\nSelesai! Diperiksa ${checkedCount} file metadata, dibuat ${createdCount} file proxy baru.`);

// Khusus untuk testpdf0-mb1aq64h-idgfms yang bermasalah
const problematicDocId = 'testpdf0-mb1aq64h-idgfms';
const expectedHash = '717efd549ed4fbf9327e34855a1a409dcc842fdc8adb95203f6c0c92f2fe923a';

console.log(`\nMemeriksa file proxy untuk ${problematicDocId}...`);

const proxyPath = path.join(uploadsDir, `${problematicDocId}.txt`);
const pdfPath = path.join(uploadsDir, `${expectedHash}.pdf`);
const metaPath = path.join(uploadsDir, `${expectedHash}.json`);

console.log(`Proxy path: ${proxyPath}`);
console.log(`PDF exists: ${fs.existsSync(pdfPath)}`);
console.log(`Metadata exists: ${fs.existsSync(metaPath)}`);

if (!fs.existsSync(proxyPath)) {
  fs.writeFileSync(proxyPath, expectedHash);
  console.log(`✓ File proxy untuk ${problematicDocId} telah dibuat!`);
} else {
  const content = fs.readFileSync(proxyPath, 'utf8').trim();
  console.log(`File proxy sudah ada dengan isi: ${content}`);
}

// Update hash-mapping.json
console.log('\nMemperbarui hash-mapping.json...');
let hashMapping = {};

try {
  if (fs.existsSync('./hash-mapping.json')) {
    const mappingData = fs.readFileSync('./hash-mapping.json', 'utf8');
    hashMapping = JSON.parse(mappingData);
  }
} catch (error) {
  console.error('Error loading hash-mapping.json:', error);
}

// Tambahkan mapping untuk dokumen yang bermasalah
hashMapping[problematicDocId] = expectedHash;
hashMapping[problematicDocId.toLowerCase()] = expectedHash;

// Simpan mapping
fs.writeFileSync('./hash-mapping.json', JSON.stringify(hashMapping, null, 2));
console.log('✓ hash-mapping.json telah diperbarui'); 