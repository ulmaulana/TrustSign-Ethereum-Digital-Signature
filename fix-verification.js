const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');
const { ethers } = require('ethers');
const DIGITAL_SIGNATURE_ABI = require('./artifacts/contracts/DigitalSignature.sol/DigitalSignature.json').abi;

// Ganti dengan alamat kontrak yang di-deploy
const CONTRACT_ADDRESS = "0xf07A6d2bfBc038AECCfe76cA4Fb4dca891e3A383";

async function main() {
  console.log("===== PERBAIKAN VERIFIKASI DOKUMEN =====");
  
  try {
    // 1. Setup provider dan kontrak
    const provider = new ethers.providers.JsonRpcProvider('http://localhost:8545');
    const contract = new ethers.Contract(
      CONTRACT_ADDRESS,
      DIGITAL_SIGNATURE_ABI,
      provider
    );
    
    // 2. Mendapatkan semua events DocumentSigned
    console.log("Mengambil semua event DocumentSigned...");
    const filter = contract.filters.DocumentSigned();
    const events = await contract.queryFilter(filter);
    
    console.log(`Ditemukan ${events.length} events`);
    
    // 3. Simpan semua hash dokumen yang terdaftar
    const registeredHashes = {};
    for (const event of events) {
      const hash = event.args.documentHash;
      const signer = event.args.signer;
      const timestamp = event.args.timestamp.toString();
      const txHash = event.transactionHash;
      
      registeredHashes[hash] = {
        signer,
        timestamp: new Date(timestamp * 1000).toLocaleString(),
        txHash
      };
    }
    
    console.log(`Total hash terdaftar: ${Object.keys(registeredHashes).length}`);
    
    // 4. Baca semua file PDF di folder uploads
    const uploadsDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      console.log("Folder uploads tidak ditemukan");
      return;
    }
    
    const files = fs.readdirSync(uploadsDir)
      .filter(f => f.endsWith('.pdf'))
      .map(f => path.join(uploadsDir, f));
    
    console.log(`\nMemeriksa ${files.length} file PDF di folder uploads...`);
    
    // 5. Cek setiap file PDF terhadap semua hash yang terdaftar
    for (const file of files) {
      console.log(`\nMemeriksa file: ${path.basename(file)}`);
      
      try {
        // Baca file PDF
        const pdfBytes = fs.readFileSync(file);
        const fileHash = ethers.utils.keccak256(pdfBytes);
        
        // Cek apakah hash file ada di blockchain
        const exactMatch = registeredHashes[fileHash];
        if (exactMatch) {
          console.log(`✅ File ini TERDAFTAR di blockchain dengan hash yang sama!`);
          console.log(`   Signer: ${exactMatch.signer}`);
          console.log(`   Waktu: ${exactMatch.timestamp}`);
          console.log(`   TxHash: ${exactMatch.txHash}`);
          
          // Update metadata
          const jsonFile = file.replace('.pdf', '.json');
          if (fs.existsSync(jsonFile)) {
            try {
              const metadata = JSON.parse(fs.readFileSync(jsonFile));
              
              // Simpan hash yang benar ke metadata
              metadata.verifiedHash = fileHash;
              metadata.signer = exactMatch.signer;
              metadata.txHash = exactMatch.txHash;
              metadata.verifiedTimestamp = exactMatch.timestamp;
              
              fs.writeFileSync(jsonFile, JSON.stringify(metadata, null, 2));
              console.log(`   Metadata diupdate dengan hash yang benar!`);
            } catch (err) {
              console.log(`   Error membaca/menulis metadata: ${err.message}`);
            }
          }
          
          continue;
        }
        
        console.log(`❌ File ini TIDAK terdaftar dengan hash yang sama di blockchain.`);
        
        // Cek apakah ada file metadata
        const jsonFile = file.replace('.pdf', '.json');
        if (fs.existsSync(jsonFile)) {
          try {
            const metadata = JSON.parse(fs.readFileSync(jsonFile));
            const metadataHash = metadata.hash;
            
            if (metadataHash && registeredHashes[metadataHash]) {
              console.log(`⚠️  Tapi hash di metadata (${metadataHash.substring(0, 10)}...) TERDAFTAR di blockchain!`);
              console.log(`   Signer: ${registeredHashes[metadataHash].signer}`);
              console.log(`   Solusi: Gunakan hash dari metadata untuk verifikasi, bukan hash file.`);
              
              // Update metadata
              metadata.originalHash = fileHash;
              metadata.verifiedHash = metadataHash;
              fs.writeFileSync(jsonFile, JSON.stringify(metadata, null, 2));
              console.log(`   Metadata diupdate dengan keterangan perbedaan hash.`);
            }
          } catch (err) {
            console.log(`   Error membaca metadata: ${err.message}`);
          }
        }
      } catch (err) {
        console.log(`Error: ${err.message}`);
      }
    }
    
    // 6. Cetak ringkasan akhir
    console.log("\n===== RINGKASAN =====");
    console.log(`Total hash terdaftar di blockchain: ${Object.keys(registeredHashes).length}`);
    console.log(`Total file PDF diperiksa: ${files.length}`);
    console.log("\nSARAN PERBAIKAN:");
    console.log("1. Pastikan sistem selalu menggunakan hash yang sama dalam seluruh proses");
    console.log("2. Gunakan metode verificateDocument yang mencari di semua hash terdaftar");
    console.log("3. Saat verifikasi, prioritaskan hash dari QR code, bukan hash file");
    
  } catch (err) {
    console.error("Error:", err);
  }
}

main().catch(console.error); 