const { execSync } = require('child_process');
const fs = require('fs');

console.log('🚀 Deploying TrustSign Backend API to Vercel...\n');

try {
  // 1. Backup original files
  console.log('📦 Preparing backend for deployment...');
  
  // Copy package-api.json to package.json temporarily
  if (fs.existsSync('package-api.json')) {
    fs.copyFileSync('package-api.json', 'package.json.backup');
  }
  
  // Copy api-vercel.json to vercel.json temporarily  
  if (fs.existsSync('api-vercel.json')) {
    fs.copyFileSync('api-vercel.json', 'vercel.json.backup');
  }
  
  console.log('✅ Files prepared for backend deployment');
  
  // 2. Instructions for manual deployment
  console.log('\n📋 Manual Deployment Instructions:');
  console.log('1. Copy server.js, package-api.json, and api-vercel.json to a new folder');
  console.log('2. Rename package-api.json to package.json');
  console.log('3. Rename api-vercel.json to vercel.json');
  console.log('4. Run: vercel --prod');
  console.log('5. Set domain to: trustsign-api-backend.vercel.app');
  
  console.log('\n🌐 Or deploy using Vercel CLI:');
  console.log('vercel --prod --name trustsign-api-backend');
  
} catch (error) {
  console.error('❌ Error preparing backend deployment:', error.message);
  process.exit(1);
} 