const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Memulai Digital Signature Blockchain Application...\n');

// Jalankan backend server
console.log('📦 Starting Backend Server (Port 5000)...');
const backend = spawn('node', ['server.js'], {
  stdio: 'inherit',
  cwd: __dirname
});

// Tunggu 3 detik sebelum menjalankan frontend
setTimeout(() => {
  console.log('\n🌐 Starting Frontend Application (Port 3000)...');
  const frontend = spawn('npm', ['start'], {
    stdio: 'inherit',
    cwd: path.join(__dirname, 'frontend'),
    shell: true
  });

  frontend.on('error', (err) => {
    console.error('❌ Error starting frontend:', err);
  });
}, 3000);

backend.on('error', (err) => {
  console.error('❌ Error starting backend:', err);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down servers...');
  backend.kill();
  process.exit(0);
});

console.log('\n📋 Instructions:');
console.log('1. Backend Server akan berjalan di: http://localhost:5000');
console.log('2. Frontend Application akan berjalan di: http://localhost:3000');
console.log('3. Tunggu beberapa detik hingga kedua server aktif');
console.log('4. Tekan Ctrl+C untuk menghentikan aplikasi\n'); 