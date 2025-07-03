# Panduan Deployment

## Masalah yang Diperbaiki

Aplikasi ini sebelumnya menggunakan `react-qr-reader@3.0.0-beta-1` yang tidak kompatibel dengan React 18. Masalah ini telah diperbaiki dengan mengganti library menjadi `@yudiel/react-qr-scanner@2.3.1` yang full kompatibel dengan React 18.

## Perubahan yang Dilakukan

1. **Mengganti Library QR Scanner**:
   - ❌ `react-qr-reader@3.0.0-beta-1` (tidak kompatibel React 18)
   - ✅ `@yudiel/react-qr-scanner@2.3.1` (kompatibel React 18)

2. **Update Kode**:
   - Import statement diubah dari `QrReader` ke `Scanner`
   - API callback diubah dari `result.text` ke `result[0].rawValue`
   - Props diubah dari `onResult` ke `onScan`

3. **Menambahkan UUID dependency** yang hilang

4. **Update Vercel Config** dengan `--legacy-peer-deps` fallback

## Cara Deploy di Vercel

1. **Push kode yang sudah diperbaiki**:
   ```bash
   git add .
   git commit -m "Fix React 18 compatibility issues"
   git push origin main
   ```

2. **Deploy otomatis akan berjalan** tanpa error dependency conflict

## Cara Testing Lokal

Jika ingin testing lokal setelah perubahan:

**Windows:**
```bash
cd frontend
npm run clean-win
npm start
```

**macOS/Linux:**
```bash
cd frontend
npm run clean
npm start
```

## Fitur QR Scanner

- QR Scanner dapat diakses melalui tab "Verifikasi Dokumen"
- Klik tombol "Scan QR Code" untuk membuka scanner
- Scanner menggunakan kamera belakang secara default
- Kompatibel dengan semua browser modern

## Troubleshooting

Jika masih ada masalah:

1. **Clear cache Vercel**: Re-deploy dengan force rebuild
2. **Local testing**: Gunakan script `npm run clean` atau `npm run clean-win`
3. **Browser compatibility**: Pastikan menggunakan HTTPS untuk akses kamera

---
