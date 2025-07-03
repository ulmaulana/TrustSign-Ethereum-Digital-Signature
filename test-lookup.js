const fs = require('fs');
const path = require('path');

// Ambil parameter dari command line
const hash = process.argv[2];

if (!hash) {
  console.error('Usage: node test-lookup.js <hash-or-docid>');
  process.exit(1);
}

console.log(`Looking up hash or docId: ${hash}`);

// Coba baca hash-mapping.json
let hashMapping = {};
try {
  if (fs.existsSync('./hash-mapping.json')) {
    const mappingData = fs.readFileSync('./hash-mapping.json', 'utf8');
    hashMapping = JSON.parse(mappingData);
    console.log(`Loaded ${Object.keys(hashMapping).length} hash mappings`);
    
    console.log('Hash Mapping Entries:');
    Object.entries(hashMapping).forEach(([key, value]) => {
      console.log(`  ${key} -> ${value}`);
    });
  }
} catch (error) {
  console.error('Error loading hash-mapping.json:', error);
}

// Cek apakah hash ada di mapping
if (hashMapping[hash]) {
  console.log(`Found in hash mapping: ${hash} -> ${hashMapping[hash]}`);
} else if (hashMapping[hash.toLowerCase()]) {
  console.log(`Found in case-insensitive mapping: ${hash.toLowerCase()} -> ${hashMapping[hash.toLowerCase()]}`);
} else {
  console.log(`Not found in hash mapping: ${hash}`);
}

// Cek file proxy
const proxyPath = path.join(__dirname, 'uploads', `${hash}.txt`);
console.log(`Checking proxy file: ${proxyPath}`);
if (fs.existsSync(proxyPath)) {
  try {
    const content = fs.readFileSync(proxyPath, 'utf8');
    console.log(`Proxy file content (${content.length} chars): '${content}'`);
    console.log(`Trimmed content (${content.trim().length} chars): '${content.trim()}'`);
  } catch (error) {
    console.error('Error reading proxy file:', error);
  }
} else {
  console.log(`Proxy file does not exist: ${proxyPath}`);
}

// Cek metadata
let actualHash = null;
if (hashMapping[hash]) {
  actualHash = hashMapping[hash];
} else if (hashMapping[hash.toLowerCase()]) {
  actualHash = hashMapping[hash.toLowerCase()];
} else {
  // Coba cari dari file proxy
  if (fs.existsSync(proxyPath)) {
    try {
      const content = fs.readFileSync(proxyPath, 'utf8').trim();
      actualHash = content;
      console.log(`Using hash from proxy file: ${actualHash}`);
    } catch (error) {
      console.error('Error reading proxy file:', error);
    }
  }
}

// Jika masih tidak ditemukan, gunakan hash asli
if (!actualHash) {
  actualHash = hash;
  console.log(`Using original hash: ${hash}`);
}

// Cek file metadata dan PDF
const metaPath = path.join(__dirname, 'uploads', `${actualHash}.json`);
const pdfPath = path.join(__dirname, 'uploads', `${actualHash}.pdf`);

console.log(`Checking metadata file: ${metaPath}`);
if (fs.existsSync(metaPath)) {
  try {
    const metadata = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    console.log('Metadata:', metadata);
  } catch (error) {
    console.error('Error reading metadata:', error);
  }
} else {
  console.log(`Metadata file does not exist: ${metaPath}`);
  
  // List file-file yang namanya mirip
  console.log('Files with similar name:');
  try {
    const files = fs.readdirSync(path.join(__dirname, 'uploads'));
    for (const file of files) {
      if (file.includes(actualHash.substring(0, 10))) {
        console.log(`  ${file}`);
      }
    }
  } catch (error) {
    console.error('Error listing files:', error);
  }
}

console.log(`Checking PDF file: ${pdfPath}`);
if (fs.existsSync(pdfPath)) {
  const stats = fs.statSync(pdfPath);
  console.log(`PDF file exists, size: ${stats.size} bytes`);
} else {
  console.log(`PDF file does not exist: ${pdfPath}`);
} 