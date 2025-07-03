// API Configuration
const config = {
  development: {
    API_URL: 'http://localhost:5000',
    ENV: 'development'
  },
  production: {
    API_URL: 'https://trustsign-api.vercel.app', // API dari folder api/ di GitHub
    ENV: 'production'
  }
};

// Deteksi environment
const isDevelopment = window.location.hostname === 'localhost' || 
                     window.location.hostname === '127.0.0.1' ||
                     window.location.hostname.includes('localhost');

const currentEnv = isDevelopment ? 'development' : 'production';

// Export konfigurasi saat ini
export const API_CONFIG = {
  ...config[currentEnv],
  BASE_URL: config[currentEnv].API_URL
};

// Helper function untuk membuat API URL
export const getApiUrl = (endpoint) => {
  return `${API_CONFIG.BASE_URL}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
};

// Log current environment
console.log('🌍 Environment:', currentEnv);
console.log('🔗 API Base URL:', API_CONFIG.BASE_URL); 