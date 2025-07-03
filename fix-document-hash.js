const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');
const { ethers } = require('ethers');

async function main() {
  console.log("===== ANALISIS HASH DOKUMEN PDF =====");
  
  // Cek folder uploads dan baca semua file PDF
  const uploadsDir = path.join(__dirname, 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    console.log("Folder uploads tidak ditemukan");
    return;
  }
  
  const files = fs.readdirSync(uploadsDir)
    .filter(f => f.endsWith('.pdf'))
    .map(f => path.join(uploadsDir, f));
  
  console.log(`Ditemukan ${files.length} file PDF di folder uploads`);
  
  // Periksa setiap file PDF
  for (const file of files) {
    console.log(`\nMemeriksa file: ${path.basename(file)}`);
    
    try {
      // Baca file PDF
      const pdfBytes = fs.readFileSync(file);
      
      // Hitung hash dari file PDF dengan ethers (hash binary)
      const fileHash = ethers.utils.keccak256(pdfBytes);
      console.log(`- Hash file: ${fileHash}`);
      
      // Coba memuat PDF dan ekstrak teks
      try {
        const pdfDoc = await PDFDocument.load(pdfBytes);
        const pdfText = await pdfDoc.saveAsBase64({dataUri: true});
        
        // Cari pola URL sertifikat kita: "/certificate/{hash}"
        const urlPattern = /\/certificate\/([a-fA-F0-9]{64})/;
        const matches = pdfText.match(urlPattern);
        
        if (matches && matches[1]) {
          const qrHash = `0x${matches[1]}`;
          console.log(`- Hash dari QR code: ${qrHash}`);
          
          if (qrHash === fileHash) {
            console.log("  [COCOK] Hash QR sama dengan hash file");
          } else {
            console.log("  [TIDAK COCOK] Hash QR berbeda dengan hash file");
          }
        } else {
          console.log("- Tidak ditemukan QR code dengan hash");
        }
        
        // Cek apakah ada file metadata JSON
        const jsonFile = file.replace('.pdf', '.json');
        if (fs.existsSync(jsonFile)) {
          try {
            const metadata = JSON.parse(fs.readFileSync(jsonFile));
            console.log("- Metadata ditemukan:");
            if (metadata.hash) {
              console.log(`  Hash metadata: ${metadata.hash}`);
            }
            if (metadata.signature) {
              console.log(`  Signature: ${metadata.signature.substring(0, 20)}...`);
            }
            if (metadata.signer) {
              console.log(`  Signer: ${metadata.signer}`);
            }
          } catch (err) {
            console.log(`  Error membaca metadata: ${err.message}`);
          }
        } else {
          console.log("- Tidak ditemukan file metadata JSON");
        }
      } catch (pdfErr) {
        console.log(`Error membaca PDF: ${pdfErr.message}`);
      }
    } catch (err) {
      console.log(`Error: ${err.message}`);
    }
  }
}

main().catch(console.error); 