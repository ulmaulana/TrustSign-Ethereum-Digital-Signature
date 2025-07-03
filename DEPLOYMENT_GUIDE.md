# 🚀 Deployment Guide - Digital Signature Blockchain

## 📋 **Masalah yang Diperbaiki**
- Frontend di Vercel tidak bisa akses localhost:5000
- API endpoints sudah dikonfigurasi dinamis untuk development & production

## 🔧 **Konfigurasi API**

### **Environment Detection**
- **Development**: `localhost:3000` → API `localhost:5000`
- **Production**: `vercel.app` → API `trust-sign-api.vercel.app`

### **File yang Dimodifikasi**
- ✅ `frontend/src/config.js` - Konfigurasi API dinamis
- ✅ `frontend/src/App.js` - Update semua API calls
- ✅ `api.vercel.json` - Konfigurasi deployment API

## 🚀 **Langkah Deployment**

### **Step 1: Deploy Backend API**
```bash
# Deploy API backend ke Vercel dengan domain khusus
vercel --prod --name trust-sign-api
```

### **Step 2: Deploy Frontend**
```bash
# Deploy frontend (sudah ada di vercel)
cd frontend
vercel --prod
```

### **Step 3: Update API URL di Config**
Update `frontend/src/config.js` jika URL API berbeda:
```javascript
production: {
  API_URL: 'https://trust-sign-api.vercel.app',
  ENV: 'production'
}
```

## 🔍 **Testing Production**

### **Test API Endpoint**
```bash
curl https://trust-sign-api.vercel.app/api/find-document/test
```

### **Test Frontend**
1. Buka: https://trust-sign-ethereum-digital-signatu.vercel.app/
2. Coba upload dokumen
3. Periksa Network tab di browser
4. API calls harus ke `trust-sign-api.vercel.app`

## 🛠️ **Troubleshooting**

### **CORS Issues**
Jika ada CORS error, tambahkan di `server.js`:
```javascript
app.use(cors({
  origin: ['https://trust-sign-ethereum-digital-signatu.vercel.app', 'http://localhost:3000'],
  credentials: true
}));
```

### **File Upload Issues**
Vercel memiliki batasan storage. Untuk production:
1. Gunakan cloud storage (AWS S3, Cloudinary)
2. Atau database untuk menyimpan file

## 📱 **URL Production**
- **Frontend**: https://trust-sign-ethereum-digital-signatu.vercel.app/
- **API**: https://trust-sign-api.vercel.app/ (will be created)

## ✅ **Status Deployment**
- [x] Frontend configuration fixed
- [x] Backend API demo created
- [x] Mock data untuk testing `testdoc1-mcnuiwop-ks4t10`
- [ ] Backend API deployment to Vercel needed
- [ ] Testing required

## 🚀 **Cara Deploy Backend API**

### **Option 1: Manual Deploy (Recommended)**
1. Buat folder baru untuk backend:
   ```bash
   mkdir trustsign-api
   cd trustsign-api
   ```

2. Copy files yang diperlukan:
   ```bash
   # Copy dari project utama
   cp ../server-demo.js ./index.js
   cp ../package-api.json ./package.json  
   cp ../api-vercel.json ./vercel.json
   ```

3. Deploy ke Vercel:
   ```bash
   vercel --prod
   # Set domain name: trustsign-api-backend
   ```

### **Option 2: Quick Deploy**
```bash
# Dari folder project utama
npm run deploy-backend
```

## 🧪 **Testing Certificate Page**

Setelah backend API di-deploy, test dengan URL:
- `https://trustsign-ethereum-digital-signatur.vercel.app/certificate/testdoc1-mcnuiwop-ks4t10`

Expected result: Halaman certificate dengan data mock yang valid. 