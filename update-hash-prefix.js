const fs = require('fs');
const path = require('path');

console.log('Memperbarui format hash agar konsisten dengan prefix 0x...');

// Baca hash-mapping.json jika ada
let hashMapping = {};
try {
  if (fs.existsSync('./hash-mapping.json')) {
    const mappingData = fs.readFileSync('./hash-mapping.json', 'utf8');
    hashMapping = JSON.parse(mappingData);
    console.log(`Berhasil membaca hash-mapping.json dengan ${Object.keys(hashMapping).length} entries`);
  } else {
    console.log('File hash-mapping.json tidak ditemukan, akan dibuat baru');
  }
} catch (error) {
  console.error('Error membaca hash-mapping.json:', error);
}

// Map sementara untuk menyimpan update
const updatedMapping = {};

// Tambahkan prefix 0x ke semua nilai hash yang belum memiliki prefix
Object.keys(hashMapping).forEach(key => {
  const value = hashMapping[key];
  
  // Skip null atau undefined
  if (!value) return;
  
  // Tambahkan prefix 0x ke nilai hash jika belum ada
  const normalizedValue = value.startsWith('0x') ? value : `0x${value}`;
  updatedMapping[key] = normalizedValue;
  
  // Log perubahan jika ada
  if (normalizedValue !== value) {
    console.log(`Updated: ${key} -> ${normalizedValue} (was: ${value})`);
  }
});

// Simpan kembali mapping yang diperbarui
fs.writeFileSync('./hash-mapping.json', JSON.stringify(updatedMapping, null, 2));
console.log(`Berhasil memperbarui dan menyimpan hash-mapping.json`);

// Cek dan perbarui file proxy
const uploadsDir = path.join(__dirname, 'uploads');
const proxyFiles = fs.readdirSync(uploadsDir)
  .filter(file => file.endsWith('.txt') && !file.startsWith('doc_'));

console.log(`\nMemeriksa ${proxyFiles.length} file proxy...`);

// Track berapa banyak file yang diperbarui
let updatedFiles = 0;

for (const proxyFile of proxyFiles) {
  try {
    const proxyPath = path.join(uploadsDir, proxyFile);
    const content = fs.readFileSync(proxyPath, 'utf8').trim();
    
    // Jika content tidak memiliki prefix 0x, tambahkan
    if (content && !content.startsWith('0x')) {
      const newContent = `0x${content}`;
      fs.writeFileSync(proxyPath, newContent);
      console.log(`✓ Diperbarui: ${proxyFile} -> ${newContent}`);
      updatedFiles++;
      
      // Perbarui juga mapping
      const docId = proxyFile.replace('.txt', '');
      if (updatedMapping[docId] !== newContent) {
        updatedMapping[docId] = newContent;
      }
    }
  } catch (error) {
    console.error(`Error memproses ${proxyFile}:`, error);
  }
}

// Jika ada update pada mapping, simpan kembali
if (updatedFiles > 0) {
  fs.writeFileSync('./hash-mapping.json', JSON.stringify(updatedMapping, null, 2));
  console.log(`Berhasil memperbarui hash-mapping.json dengan ${updatedFiles} perubahan baru`);
}

console.log(`\nSelesai! ${updatedFiles} file proxy diperbarui.`);
console.log('Silakan restart server untuk menerapkan perubahan'); 