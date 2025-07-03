# Digital Signature Blockchain

Aplikasi web fullstack untuk implementasi digital signature pada surat elektronik dengan integrasi blockchain Ethereum.

## Fitur

- Unggah dokumen (PDF/TXT)
- Generate hash dokumen menggunakan SHA-256
- Tanda tangan digital dengan private key melalui MetaMask
- Penyimpanan hash dan tanda tangan ke smart contract di Sepolia
- Verifikasi tanda tangan digital

## Teknologi

### Frontend
- React.js
- Ethers.js
- Bootstrap
- React-Bootstrap

### Smart Contract
- Solidity
- Hardhat
- OpenZeppelin

### Blockchain
- Ethereum Sepolia Testnet
- MetaMask Wallet
- Infura/Alchemy

## Instalasi

1. Clone repositori
```bash
git clone [url-repositori]
cd digital-signature-blockchain
```

2. Install dependensi
```bash
npm install
```

3. Buat file .env
```bash
cp .env.example .env
```
Isi file .env dengan konfigurasi yang sesuai:
```
SEPOLIA_RPC_URL=YOUR_SEPOLIA_INFURA_RPC
PRIVATE_KEY=YOUR_METAMASK_PRIVATEKEY
ETHERSCAN_API_KEY=YOUR_ETHERSCAN_API
CONTRACT_ADDRESS=your_deployed_contract_address
```

4. Deploy smart contract
```bash
npx hardhat run scripts/deploy.js --network sepolia
```

5. Jalankan aplikasi
```bash
npm start
```

## Arsitektur Sistem

1. Frontend (React)
   - Komponen untuk unggah dokumen
   - Integrasi MetaMask
   - Generate hash dan tanda tangan
   - Interaksi dengan smart contract

2. Smart Contract
   - Penyimpanan hash dan tanda tangan
   - Verifikasi tanda tangan
   - Event logging

3. Blockchain
   - Jaringan Sepolia Testnet
   - MetaMask untuk manajemen wallet
   - Infura/Alchemy untuk RPC endpoint

## Keamanan

- Private key disimpan di MetaMask
- Hash dokumen di-generate secara lokal
- Verifikasi tanda tangan di blockchain
- Event logging untuk audit trail

## Alur Data

1. Pengguna mengunggah dokumen
2. Sistem generate hash dokumen
3. Pengguna menandatangani dengan MetaMask
4. Hash dan tanda tangan disimpan ke blockchain
5. Verifikasi dapat dilakukan kapan saja

## Kontribusi

Silakan buat pull request untuk kontribusi. Untuk perubahan besar, buka issue terlebih dahulu untuk diskusi.

## Lisensi

MIT 

## Pembaruan Terbaru

Beberapa perbaikan telah dilakukan pada aplikasi:

1. **Perbaikan Penyimpanan File PDF**
   - Implementasi penggunaan hash sebagai nama file PDF
   - Penanganan upload file dengan middleware khusus untuk ekstraksi hash 
   - Pemastian file tersimpan dengan nama yang benar di server

2. **Konsistensi Transaction Hash**
   - Penambahan mapping tetap untuk menangani transaction hash
   - Implementasi fungsi helper `getCorrectTxHash` untuk mendapatkan transaction hash yang benar
   - Endpoint API baru `/api/update-metadata` untuk memperbarui metadata dokumen dengan transaction hash

3. **Peningkatan UI**
   - Tampilan halaman sertifikat yang lebih modern
   - Penanganan transaction hash yang tidak tersedia
   - Konsistensi link ke Etherscan

4. **Logging dan Debugging**
   - Peningkatan logging di server dan client
   - Informasi pemecahan masalah yang lebih jelas
   - Mekanisme backup file untuk mencegah kehilangan data

## Troubleshooting

Jika mengalami masalah:

1. **Certificate Not Found**
   - Pastikan file PDF dengan nama hash tersimpan di folder `/uploads`
   - Periksa file JSON metadata terkait di folder yang sama
   - Restart server jika diperlukan: `node server.js`

2. **Transaction Hash Tidak Sesuai**
   - Tambahkan mapping baru di `TX_HASH_MAPPING` di `App.js`
   - Format: `'0xHASH_DOKUMEN': '0xTRANSACTION_HASH'`
   - Restart aplikasi setelah menambahkan mapping baru 

# Deployment ke Vercel

## Struktur Project Full-Stack

Project ini telah dikonfigurasi untuk deployment full-stack di Vercel dengan:
- **Frontend**: React app di folder `frontend/`  
- **Backend**: Serverless API functions di folder `api/`

## Langkah-langkah Deployment

### 1. Persiapan Local
```bash
# Install dependencies frontend
cd frontend
npm install

# Test build frontend
npm run build

# Kembali ke root
cd ..
```

### 2. Push ke GitHub
```bash
git add .
git commit -m "Setup untuk Vercel deployment"
git push origin main
```

### 3. Deploy di Vercel

#### Opsi A: Vercel Dashboard
1. Buka [vercel.com](https://vercel.com)
2. Login dan klik "New Project"
3. Import repository dari GitHub
4. Vercel akan otomatis mendeteksi konfigurasi dari `vercel.json`
5. Klik "Deploy"

#### Opsi B: Vercel CLI
```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel --prod
```

## Konfigurasi yang Sudah Disiapkan

### File `vercel.json`
- Mengatur build untuk frontend dan backend
- Routing API ke `/api/*` 
- Static files ke frontend

### File `api/server.js`
- Vercel-compatible serverless functions
- Simplified version dari server Express original
- Memory storage untuk file uploads (production butuh external storage)

## Limitasi Vercel Functions

⚠️ **Perhatian**: Vercel Functions memiliki beberapa limitasi:

1. **File Storage**: Tidak bisa menyimpan file secara permanen
   - Solusi: Gunakan AWS S3, Cloudinary, atau database
   
2. **Execution Time**: Maksimal 10 detik per function
   - Solusi: Optimasi kode atau gunakan background jobs
   
3. **Memory**: Terbatas berdasarkan plan
   - Solusi: Upgrade plan atau optimasi memory usage

## Alternative: Deploy Terpisah

Jika Vercel Functions tidak cocok untuk backend complex, bisa deploy terpisah:

### Frontend di Vercel
- Gunakan konfigurasi frontend only
- Update API endpoints di frontend ke URL backend terpisah

### Backend di Platform Lain
- **Railway**: Support full Node.js server
- **Render**: Free tier dengan persistent storage  
- **Heroku**: Traditional platform as a service
- **DigitalOcean App Platform**: Container-based deployment

## Environment Variables

Jangan lupa set environment variables di Vercel dashboard:
- `NODE_ENV=production`
- Database URLs (jika ada)
- External service API keys

## Troubleshooting

### Build Errors
```bash
# Cek build frontend
cd frontend && npm run build

# Cek dependencies API
cd api && npm install
```

### API Tidak Berfungsi
- Cek logs di Vercel Functions tab
- Pastikan semua dependencies ada di `api/package.json`
- Test endpoint local dulu

### File Upload Issues
- Vercel Functions tidak bisa menyimpan file
- Implementasi external storage service
- Atau gunakan platform lain untuk backend 