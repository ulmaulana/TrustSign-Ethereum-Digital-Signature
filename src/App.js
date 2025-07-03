import React, { useState, useEffect, useRef } from 'react';
import { 
  Container, 
  Row, 
  Col, 
  Form, 
  Button, 
  Alert, 
  Card, 
  Navbar, 
  Nav, 
  ProgressBar,
  Modal,
  Badge,
  Spinner,
  Collapse,
  OverlayTrigger,
  Tooltip,
  ListGroup
} from 'react-bootstrap';
import { ethers } from 'ethers';
import { BrowserRouter as Router, Route, Routes, useParams } from 'react-router-dom';
import './App.css';
import html2canvas from 'html2canvas';
import QRCode from 'qrcode';
import axios from 'axios';

const CONTRACT_ADDRESS = process.env.REACT_APP_CONTRACT_ADDRESS;
const API_URL = 'http://localhost:5000';

// Mapping hash dokumen ke transaction hash
const TX_HASH_MAPPING = {
  // Hash dokumen dengan awalan 0x
  '0x47b1d63244d710339f131c4ed8cfc497dba4cbb16c387e90b501a799d6946e3e': '0x9e6c2047ea519f12ff58f9372fefb9db03156b294fb18ded707917ce7322bfc5',
  
  // Hash dokumen tanpa awalan 0x
  '47b1d63244d710339f131c4ed8cfc497dba4cbb16c387e90b501a799d6946e3e': '0x9e6c2047ea519f12ff58f9372fefb9db03156b294fb18ded707917ce7322bfc5',
  
  // Mapping lain dari frontend/src/App.js
  '9e00b9959be892ab51b122b77bb80cf4b9699a31ee99ba889d3dd876e8172e70': '0x27d9a3ede9c512dec66dfd22610e5bd495414e0e3ed11cbaab6ec77c555e7f08',
  '86dd3a2882da8a2cd3172177a1126e4ea5f4d8b5c985e86db845204ba92b64e0': '0x8f0cc5a11b5b31664e5c3ab80a2fe60af5be3bad8b1e866dd3e97ebd9e4ac5c1',
  
  // Hash dokumen baru yang ditambahkan
  '0xb201bcb57f9e99c5d84d409f3019c3f8e4c9234981496371c63a44a17d44e3ce': '0x10bfcd1592dda6e8b589559fbfe6fd6e4a9c6bb5e8e9cb8c51ba3a33803adfcb',
  'b201bcb57f9e99c5d84d409f3019c3f8e4c9234981496371c63a44a17d44e3ce': '0x10bfcd1592dda6e8b589559fbfe6fd6e4a9c6bb5e8e9cb8c51ba3a33803adfcb'
};

// Helper untuk mendapatkan transaction hash yang benar
const getCorrectTxHash = (docHash, fallbackTxHash = '') => {
  if (!docHash) return fallbackTxHash;
  
  // Normalize hash - ubah ke lowercase
  const normalizedHash = docHash.toLowerCase();
  
  // Format hash dengan dan tanpa awalan 0x
  const hashWithout0x = normalizedHash.startsWith('0x') ? normalizedHash.substring(2) : normalizedHash;
  const hashWith0x = normalizedHash.startsWith('0x') ? normalizedHash : `0x${normalizedHash}`;
  
  console.log('Mencari transaction hash untuk dokumen:', {
    docHash,
    normalizedHash,
    hashWithout0x,
    hashWith0x
  });
  
  // Periksa di mapping dengan semua kemungkinan format
  if (TX_HASH_MAPPING[normalizedHash]) {
    console.log(`Ditemukan di mapping (format asli): ${TX_HASH_MAPPING[normalizedHash]}`);
    return TX_HASH_MAPPING[normalizedHash];
  }
  
  if (TX_HASH_MAPPING[hashWithout0x]) {
    console.log(`Ditemukan di mapping (tanpa 0x): ${TX_HASH_MAPPING[hashWithout0x]}`);
    return TX_HASH_MAPPING[hashWithout0x];
  }
  
  if (TX_HASH_MAPPING[hashWith0x]) {
    console.log(`Ditemukan di mapping (dengan 0x): ${TX_HASH_MAPPING[hashWith0x]}`);
    return TX_HASH_MAPPING[hashWith0x];
  }
  
  console.log('Hash tidak ditemukan di mapping, menggunakan fallback:', fallbackTxHash);
  return fallbackTxHash;
};

// Fungsi untuk sinkronisasi transaction hash
const syncTransactionHash = async (docHash, txHash) => {
  if (!docHash || !txHash) return;
  
  // Simpan ke mapping lokal untuk digunakan langsung
  const normalizedHash = docHash.toLowerCase();
  const hashWithout0x = normalizedHash.startsWith('0x') ? normalizedHash.substring(2) : normalizedHash;
  const hashWith0x = normalizedHash.startsWith('0x') ? normalizedHash : `0x${normalizedHash}`;
  
  // Update semua format hash di mapping
  TX_HASH_MAPPING[normalizedHash] = txHash;
  TX_HASH_MAPPING[hashWithout0x] = txHash;
  TX_HASH_MAPPING[hashWith0x] = txHash;
  
  console.log('Mapping lokal diperbarui untuk hash:', {
    docHash,
    txHash
  });
  
  try {
    // Update juga di server metadata
    const cleanHash = docHash.startsWith('0x') ? docHash.substring(2) : docHash;
    
    // Cek metadata yang ada
    const response = await axios.get(`${API_URL}/api/certificate/${cleanHash}`);
    if (response.data && (!response.data.txHash || response.data.txHash !== txHash)) {
      const metadata = response.data;
      metadata.txHash = txHash;
      
      // Kirim update ke server
      await axios.post(`${API_URL}/api/update-metadata`, {
        hash: cleanHash,
        metadata
      });
      
      console.log('Metadata server diperbarui dengan transaction hash:', txHash);
    }
  } catch (error) {
    console.error('Gagal memperbarui metadata di server:', error);
  }
};

// Fungsi untuk mencari transaction hash di blockchain berdasarkan hash dokumen
async function findTransactionHashFromBlockchain(docHash, provider, contract) {
  if (!docHash || !provider || !contract) return null;
  
  console.log('Mencari transaction hash di blockchain untuk:', docHash);
  
  try {
    // METODE 1: Coba panggil getSignature untuk mendapatkan data signature di contract
    try {
      // Normalisasi hash - pastikan format sesuai untuk parameter fungsi contract
      let normalizedHash = docHash;
      if (!normalizedHash.startsWith('0x')) {
        normalizedHash = '0x' + normalizedHash;
      }
      
      console.log('Mencoba mengambil signature dengan getSignature untuk hash:', normalizedHash);
      const signatureData = await contract.getSignature(normalizedHash);
      
      if (signatureData && signatureData.signer && signatureData.signer !== ethers.constants.AddressZero) {
        console.log('Signature ditemukan di contract untuk hash:', normalizedHash);
        
        // Jika signature ada, cari event terkait untuk mendapatkan transaction hash
        const filter = contract.filters.DocumentSigned(normalizedHash);
        const events = await contract.queryFilter(filter);
        
        if (events.length > 0) {
          const txHash = events[0].transactionHash;
          console.log('Transaction hash ditemukan langsung dari event dengan hash standar:', txHash);
          return txHash;
        }
      }
    } catch (getSignatureError) {
      console.log('Error saat memanggil getSignature:', getSignatureError.message);
    }
  } catch (initialError) {
    console.warn('Error pada pencarian awal:', initialError);
  }
  
  // METODE 2: Daftar format hash yang akan dicoba
  const hashFormats = [
    docHash, 
    docHash.toLowerCase(),
    docHash.toUpperCase(),
    docHash.startsWith('0x') ? docHash.substring(2) : `0x${docHash}`,
    docHash.startsWith('0x') ? docHash.substring(2).toLowerCase() : `0x${docHash.toLowerCase()}`,
    docHash.startsWith('0x') ? docHash.substring(2).toUpperCase() : `0x${docHash.toUpperCase()}`,
    docHash.startsWith('0x') ? `0x${docHash.substring(2).toLowerCase()}` : docHash.toLowerCase(),
    docHash.startsWith('0x') ? `0x${docHash.substring(2).toUpperCase()}` : docHash.toUpperCase()
  ];
  
  // Filter duplikat
  const uniqueHashFormats = [...new Set(hashFormats)];
  console.log('Mencoba format hash:', uniqueHashFormats);
  
  // Coba tiap format hash
  for (const hashFormat of uniqueHashFormats) {
    try {
      console.log('Mencari dengan format hash:', hashFormat);
      const filter = contract.filters.DocumentSigned(hashFormat);
      const events = await contract.queryFilter(filter);
      
      if (events.length > 0) {
        const txHash = events[0].transactionHash;
        console.log(`Transaction hash ditemukan dengan format hash ${hashFormat}:`, txHash);
        return txHash;
      }
    } catch (error) {
      console.warn(`Error mencari dengan format hash ${hashFormat}:`, error);
      // Lanjut ke format hash berikutnya
    }
  }
  
  // METODE 3: Jika tidak ada yang cocok, cari di semua event DocumentSigned (scan lengkap)
  try {
    console.log('Mencari di semua event DocumentSigned...');
    const filter = contract.filters.DocumentSigned();
    const events = await contract.queryFilter(filter);
    console.log(`Ditemukan ${events.length} event DocumentSigned total`);
    
    // Siapkan semua format hash yang mungkin untuk pencocokan
    const hashFormats = uniqueHashFormats.map(h => h.toLowerCase());
    
    for (const event of events) {
      if (!event.args || !event.args.documentHash) continue;
      
      const eventDocHash = event.args.documentHash.toLowerCase();
      
      // Cek semua format hash yang mungkin
      if (hashFormats.some(format => eventDocHash === format)) {
        const txHash = event.transactionHash;
        console.log(`Transaction hash ditemukan dari scan lengkap:`, txHash);
        return txHash;
      }
    }
    
    // Jika masih belum ketemu, coba perbandingan substring (6-8 karakter terakhir)
    // Terkadang hashing berbeda tetapi memiliki suffix yang sama
    console.log('Mencoba pencocokan substring (6-8 karakter terakhir)...');
    const suffixLength = 8;
    const docHashSuffix = docHash.substring(docHash.length - suffixLength).toLowerCase();
    
    for (const event of events) {
      if (!event.args || !event.args.documentHash) continue;
      
      const eventDocHash = String(event.args.documentHash).toLowerCase();
      const eventSuffix = eventDocHash.substring(eventDocHash.length - suffixLength);
      
      if (eventSuffix === docHashSuffix) {
        const txHash = event.transactionHash;
        console.log(`Transaction hash ditemukan dari pencocokan suffix:`, txHash);
        console.log(`Document hash di blockchain: ${eventDocHash}`);
        console.log(`Document hash di parameter: ${docHash}`);
        return txHash;
      }
    }
  } catch (error) {
    console.error('Error mencari di semua event:', error);
  }
  
  // METODE 4: Coba akses langsung ke Etherscan API sebagai fallback terakhir
  try {
    // Tergantung pada API yang tersedia - contoh ini perlu dimodifikasi sesuai kebutuhan
    console.log('Metode fallback ke Etherscan tidak diimplementasi');
  } catch (error) {
    console.warn('Error pada metode fallback:', error);
  }
  
  console.log('Transaction hash tidak ditemukan di blockchain');
  return null;
}

// Komponen untuk halaman sertifikat
function CertificatePage() {
  const { hash } = useParams();
  const [certificate, setCertificate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    const fetchCertificate = async () => {
      try {
        // Ambil data sertifikat dari server
        const response = await axios.get(`${API_URL}/api/certificate/${hash}`);
        setCertificate(response.data);
      } catch (error) {
        console.error('Error fetching certificate:', error);
        setError('Sertifikat tidak ditemukan atau tidak valid');
      } finally {
        setLoading(false);
      }
    };

    if (hash) {
      console.log('Memuat sertifikat untuk hash:', hash);
      fetchCertificate();
    }
  }, [hash]);

  // Fungsi untuk menyalin link ke clipboard
  const copyToClipboard = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Fungsi untuk download PDF
  const downloadPDF = () => {
    if (certificate && certificate.pdfUrl) {
      const link = document.createElement('a');
      link.href = `${API_URL}${certificate.pdfUrl}`;
      link.download = `document-${hash.substring(0, 8)}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Fungsi untuk berbagi ke sosmed
  const shareCertificate = (platform) => {
    const url = window.location.href;
    const text = `Verifikasi dokumen digital dengan blockchain: `;
    
    let shareUrl;
    switch(platform) {
      case 'whatsapp':
        shareUrl = `https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`;
        break;
      case 'telegram':
        shareUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
        break;
      default:
        return;
    }
    
    window.open(shareUrl, '_blank');
  };

  // Fungsi untuk memformat hash
  const formatHash = (hash) => {
    if (!hash) return '';
    return `${hash.substring(0, 8)}...${hash.substring(hash.length - 8)}`;
  };

  return (
    <Container className="certificate-container my-5">
      <Card className="certificate-card shadow-sm">
        <Card.Header className="text-center bg-primary text-white py-3">
          <h3 className="mb-0">
            <i className="fas fa-certificate me-2"></i>
            Sertifikat Digital Blockchain
          </h3>
        </Card.Header>
        <Card.Body>
          {loading ? (
            <div className="text-center py-5">
              <Spinner animation="border" variant="primary" />
              <p className="mt-3">Memuat sertifikat...</p>
            </div>
          ) : error ? (
            <Alert variant="danger" className="d-flex align-items-center">
              <i className="fas fa-exclamation-triangle me-2"></i>
              {error}
            </Alert>
          ) : certificate ? (
            <>
              <Row className="mb-4">
                <Col>
                  <div className="certificate-header text-center mb-4">
                    <div className="verification-badge">
                      <i className="fas fa-shield-check text-success me-2"></i>
                      <span className="h4 mb-0">Dokumen Terverifikasi</span>
                      <Badge bg="success" className="ms-2 p-2">
                        <i className="fas fa-check-circle me-1"></i>
                        Terverifikasi
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="certificate-actions mb-4 d-flex justify-content-center gap-2">
                    <OverlayTrigger
                      placement="top"
                      overlay={<Tooltip>{copied ? 'Disalin!' : 'Salin link'}</Tooltip>}
                    >
                      <Button variant="outline-primary" onClick={copyToClipboard}>
                        <i className={`fas ${copied ? 'fa-check' : 'fa-copy'} me-2`}></i>
                        {copied ? 'Disalin' : 'Salin Link'}
                      </Button>
                    </OverlayTrigger>
                    
                    <OverlayTrigger
                      placement="top"
                      overlay={<Tooltip>Unduh PDF</Tooltip>}
                    >
                      <Button variant="outline-success" onClick={downloadPDF}>
                        <i className="fas fa-download me-2"></i>
                        Unduh PDF
                      </Button>
                    </OverlayTrigger>
                    
                    <OverlayTrigger
                      placement="top"
                      overlay={<Tooltip>Bagikan ke WhatsApp</Tooltip>}
                    >
                      <Button variant="outline-success" onClick={() => shareCertificate('whatsapp')}>
                        <i className="fab fa-whatsapp me-2"></i>
                        Bagikan ke WhatsApp
                      </Button>
                    </OverlayTrigger>
                  </div>
                </Col>
              </Row>
              
              <Row className="document-info mb-4">
                <Col md={12}>
                  <Card className="mb-3 border-light">
                    <Card.Header className="bg-light">
                      <h5 className="mb-0">
                        <i className="fas fa-info-circle me-2"></i>
                        Informasi Dokumen
                      </h5>
                    </Card.Header>
                    <ListGroup variant="flush">
                      <ListGroup.Item className="d-flex justify-content-between align-items-center">
                        <span><strong>Hash Dokumen:</strong></span>
                        <span className="text-monospace hash-value">
                          <code>{formatHash(hash)}</code>
                          <Button 
                            variant="link" 
                            size="sm" 
                            className="text-muted p-0 ms-2"
                            onClick={() => navigator.clipboard.writeText(hash)}
                          >
                            <i className="fas fa-copy"></i>
                          </Button>
                        </span>
                      </ListGroup.Item>
                      
                      <ListGroup.Item className="d-flex justify-content-between align-items-center">
                        <span><strong>Penandatangan:</strong></span>
                        <span className="text-break">
                          <i className="fas fa-user-check me-1 text-success"></i>
                          {certificate.signer}
                          <Button 
                            variant="link" 
                            size="sm" 
                            className="text-muted p-0 ms-2"
                            onClick={() => navigator.clipboard.writeText(certificate.signer)}
                          >
                            <i className="fas fa-copy"></i>
                          </Button>
                        </span>
                      </ListGroup.Item>
                      
                      <ListGroup.Item>
                        <div className="d-flex justify-content-between align-items-center">
                          <span><strong>Tanda Tangan:</strong></span>
                          <Button 
                            variant="link" 
                            className="p-0 text-primary"
                            onClick={() => setShowDetails(!showDetails)}
                          >
                            {showDetails ? "Sembunyikan Detail" : "Tampilkan Detail"}
                          </Button>
                        </div>
                        <Collapse in={showDetails}>
                          <div className="mt-2">
                            <code className="signature-code d-block p-2 bg-light rounded">
                              {certificate.signature}
                            </code>
                            <Button 
                              variant="outline-secondary" 
                              size="sm" 
                              className="mt-2"
                              onClick={() => navigator.clipboard.writeText(certificate.signature)}
                            >
                              <i className="fas fa-copy me-2"></i>
                              Salin Tanda Tangan
                            </Button>
                          </div>
                        </Collapse>
                      </ListGroup.Item>
                    </ListGroup>
                  </Card>
                </Col>
              </Row>
              
              <Row className="pdf-viewer-row">
                <Col md={12}>
                  <div className="pdf-container border rounded overflow-hidden shadow-sm">
                    <iframe
                      src={`${API_URL}${certificate.pdfUrl}`}
                      width="100%"
                      height="600px"
                      title="Dokumen PDF"
                      className="pdf-iframe"
                    />
                  </div>
                </Col>
              </Row>
            </>
          ) : (
            <Alert variant="warning">
              <i className="fas fa-exclamation-circle me-2"></i>
              Tidak ada data sertifikat
            </Alert>
          )}
        </Card.Body>
        <Card.Footer className="text-center text-muted py-3">
          <p className="mb-0">
            <i className="fas fa-lock me-2"></i>
            Dokumen ini diamankan dengan teknologi blockchain
          </p>
        </Card.Footer>
      </Card>
    </Container>
  );
}

// Main App Component
function App() {
  const [file, setFile] = useState(null);
  const [hash, setHash] = useState('');
  const [signature, setSignature] = useState('');
  const [status, setStatus] = useState('');
  const [account, setAccount] = useState('');
  const [balance, setBalance] = useState('');
  const [network, setNetwork] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [activeTab, setActiveTab] = useState('sign');
  const [dataInitialized, setDataInitialized] = useState(false);
  
  // Fungsi untuk memuat riwayat dokumen dari blockchain
  const loadDocumentsHistory = async () => {
    if (!window.ethereum || !account) {
      setStatus('Silakan hubungkan wallet terlebih dahulu');
      return;
    }

    try {
      setLoading(true);
      setStatus('Memuat riwayat dokumen...');
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const contract = new ethers.Contract(
        CONTRACT_ADDRESS,
        [
          'function getDocumentCount(address) view returns (uint256)',
          'function getDocumentByIndex(address, uint256) view returns (bytes32, bytes, uint256)'
        ],
        provider
      );

      // Mendapatkan jumlah dokumen untuk akun yang terhubung
      const count = await contract.getDocumentCount(account);
      const loadedDocuments = [];

      // Memuat informasi setiap dokumen
      for (let i = 0; i < count; i++) {
        const [hash, signature, timestamp] = await contract.getDocumentByIndex(account, i);
        
        // Mencari transaction hash dari blockchain langsung (prioritas utama)
        let txHash = '';
        try {
          // PRIORITAS 1: Cari dari blockchain events (sumber paling akurat)
          console.log(`Mencari transaction hash di blockchain untuk dokumen ${i+1}:`, hash);
          // Persiapkan contract dengan interface yang memiliki event
          const contractWithEvents = new ethers.Contract(
            CONTRACT_ADDRESS,
            [
              'function getSignature(bytes32) view returns (address signer, bytes signature, uint256 timestamp)',
              'event DocumentSigned(bytes32 indexed documentHash, address indexed signer, bytes signature, uint256 timestamp)'
            ],
            provider
          );
          
          // Gunakan fungsi pencarian komprehensif untuk mendapatkan transaction hash
          txHash = await findTransactionHashFromBlockchain(hash, provider, contractWithEvents);
          
          if (txHash) {
            console.log(`Transaction hash ditemukan dari blockchain:`, txHash);
            
            // Sinkronisasi ke sistem
            await syncTransactionHash(hash, txHash);
          } else {
            console.log('Tidak ada event ditemukan untuk hash dokumen ini');
            
            // PRIORITAS 2: Jika tidak ada di blockchain events, cek di mapping atau server
            // Cek di mapping lokal
            txHash = getCorrectTxHash(hash, '');
            
            if (txHash) {
              console.log(`Transaction hash ditemukan dari mapping lokal:`, txHash);
            } else {
              // Cek di server
              const cleanHash = hash.startsWith('0x') ? hash.substring(2) : hash;
              try {
                const certResponse = await axios.get(`${API_URL}/api/certificate/${cleanHash}`);
                if (certResponse.data && certResponse.data.txHash) {
                  txHash = certResponse.data.txHash;
                  console.log(`Transaction hash ditemukan dari server:`, txHash);
                }
              } catch (serverError) {
                console.warn(`Gagal mendapatkan data dari server:`, serverError);
              }
            }
          }
        } catch (txError) {
          console.warn(`Gagal mendapatkan tx hash untuk dokumen ${hash}:`, txError);
        }
        
        loadedDocuments.push({
          name: `Document ${i+1}`,  // Nama dokumen mungkin tidak disimpan di blockchain
          hash,
          signature,
          timestamp: new Date(timestamp * 1000).toISOString(),  // Konversi timestamp blockchain
          txHash // Tampilkan transaction hash jika ada
        });
      }

      setDocuments(loadedDocuments);
      setStatus(`${loadedDocuments.length} dokumen berhasil dimuat`);
      
      // Pastikan semua document memiliki transaction hash yang konsisten
      loadedDocuments.forEach(doc => {
        if (doc.txHash) {
          syncTransactionHash(doc.hash, doc.txHash);
        }
      });
      
    } catch (error) {
      console.error('Error memuat riwayat dokumen:', error);
      setStatus('Error memuat riwayat dokumen: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        setLoading(true);
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        setAccount(accounts[0]);
        
        // Get network
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const network = await provider.getNetwork();
        setNetwork(network.name);
        
        // Get balance
        const balance = await provider.getBalance(accounts[0]);
        setBalance(ethers.utils.formatEther(balance));
        
        setStatus('Wallet terhubung');
      } catch (error) {
        setStatus('Error menghubungkan wallet');
      } finally {
        setLoading(false);
      }
    } else {
      setStatus('MetaMask tidak terinstall');
    }
  };

  useEffect(() => {
    if (window.ethereum) {
      connectWallet();
    }
  }, []);

  // Efek untuk memuat riwayat dokumen saat akun berubah
  useEffect(() => {
    if (account && activeTab === 'history') {
      loadDocumentsHistory();
    }
  }, [account, activeTab]);

  // Tambahkan efek untuk sinkronisasi transaction hash
  useEffect(() => {
    const initializeHashMapping = async () => {
      if (dataInitialized) return;
      
      try {
        // Coba ambil file list dari server untuk sinkronisasi
        const response = await axios.get(`${API_URL}/api/files`);
        if (response.data && response.data.files) {
          const jsonFiles = response.data.files.filter(file => file.extension === '.json');
          
          // Proses setiap file metadata
          for (const jsonFile of jsonFiles) {
            try {
              const hash = jsonFile.name.replace('.json', '');
              // Ambil data metadata
              const metaResponse = await axios.get(`${API_URL}/api/certificate/${hash}`);
              
              if (metaResponse.data && metaResponse.data.txHash) {
                const docHash = hash;
                const txHash = metaResponse.data.txHash;
                
                // Update mapping dengan transaction hash dari server
                const hashWith0x = docHash.startsWith('0x') ? docHash : `0x${docHash}`;
                TX_HASH_MAPPING[hashWith0x] = txHash;
                TX_HASH_MAPPING[docHash] = txHash;
                
                console.log(`Sinkronisasi hash mapping: ${docHash} -> ${txHash}`);
              }
            } catch (err) {
              console.warn(`Gagal memproses file ${jsonFile.name}:`, err);
            }
          }
        }
        
        setDataInitialized(true);
        console.log('Inisialisasi data transaction hash selesai');
      } catch (error) {
        console.error('Gagal menginisialisasi hash mapping:', error);
      }
    };
    
    initializeHashMapping();
  }, [dataInitialized]);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      setFile(file);
      generateHash(file);
    }
  };

  const generateHash = async (file) => {
    setLoading(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target.result;
      const hash = ethers.utils.keccak256(content);
      setHash(hash);
      setLoading(false);
    };
    reader.readAsArrayBuffer(file);
  };

  // Fungsi untuk membuat QR code pada canvas
  const generateQRCode = async (text) => {
    const canvas = document.createElement('canvas');
    await QRCode.toCanvas(canvas, text, {
      width: 150,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    return canvas;
  };

  // Fungsi untuk menempelkan QR code ke dokumen PDF
  const attachQRCodeToPDF = async (pdfFile, hash) => {
    try {
      // URL QR code untuk halaman sertifikat
      const certificateUrl = `${window.location.origin}/certificate/${hash}`;
      console.log('Membuat QR code dengan URL:', certificateUrl);
      
      // Buat QR code dengan URL sertifikat
      const qrCanvas = await generateQRCode(certificateUrl);
      
      // Buat tampilan sementara untuk dokumen PDF
      const pdfContainer = document.createElement('div');
      pdfContainer.style.position = 'relative';
      pdfContainer.style.width = '100%';
      pdfContainer.style.height = '100%';
      document.body.appendChild(pdfContainer);
      
      // Buat objek URL untuk PDF
      const pdfUrl = URL.createObjectURL(pdfFile);
      
      // Buat iframe untuk menampilkan PDF
      const iframe = document.createElement('iframe');
      iframe.src = pdfUrl;
      iframe.style.width = '100%';
      iframe.style.height = '500px';
      iframe.style.border = 'none';
      
      pdfContainer.appendChild(iframe);
      
      // Tunggu iframe dimuat
      await new Promise((resolve) => {
        iframe.onload = resolve;
      });
      
      // Tambahkan QR code ke pojok kanan bawah
      const qrCodeDiv = document.createElement('div');
      qrCodeDiv.style.position = 'absolute';
      qrCodeDiv.style.right = '20px';
      qrCodeDiv.style.bottom = '20px';
      qrCodeDiv.style.zIndex = '1000';
      qrCodeDiv.appendChild(qrCanvas);
      
      pdfContainer.appendChild(qrCodeDiv);
      
      // Konversi tampilan ke canvas menggunakan html2canvas
      const canvas = await html2canvas(pdfContainer, {
        useCORS: true,
        allowTaint: true,
        scrollX: 0,
        scrollY: 0
      });
      
      // Konversi canvas ke Blob PDF
      const canvasData = canvas.toDataURL('application/pdf');
      const pdfWithQR = await fetch(canvasData).then(res => res.blob());
      
      // Bersihkan tampilan sementara
      document.body.removeChild(pdfContainer);
      URL.revokeObjectURL(pdfUrl);
      
      console.log('QR code berhasil ditambahkan ke PDF');
      return pdfWithQR;
    } catch (error) {
      console.error('Error menempelkan QR code ke PDF:', error);
      throw error;
    }
  };

  const signDocument = async () => {
    if (!window.ethereum || !account) {
      setStatus('Silakan hubungkan wallet terlebih dahulu');
      return;
    }

    if (!file) {
      setStatus('Silakan pilih file dokumen terlebih dahulu');
      return;
    }

    try {
      setLoading(true);
      setStatus('Memproses dokumen dan QR code...');
      
      // Ambil hash asli dokumen
      const originalHash = hash;
      console.log('Hash original dokumen:', originalHash);
      
      // Tempelkan QR code ke PDF
      const pdfWithQR = await attachQRCodeToPDF(file, originalHash);
      
      // Generate hash baru dari PDF dengan QR code
      const reader = new FileReader();
      const hashPromise = new Promise((resolve, reject) => {
        reader.onload = async (e) => {
          try {
            const content = e.target.result;
            const newHash = ethers.utils.keccak256(content);
            resolve(newHash);
          } catch (error) {
            reject(error);
          }
        };
        reader.onerror = reject;
      });
      
      reader.readAsArrayBuffer(pdfWithQR);
      const newHash = await hashPromise;
      console.log('Hash baru setelah menambahkan QR code:', newHash);
      
      // Simpan hash baru agar bisa dipakai di tempat lain
      setHash(newHash);
      
      // Tandatangani hash baru
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const signature = await signer.signMessage(newHash);
      setSignature(signature);
      console.log('Signature:', signature);
      
      // PENTING: Pastikan hash yang digunakan sebagai nama file adalah hexString (tanpa 0x)
      const cleanHash = newHash.startsWith('0x') ? newHash.substring(2) : newHash;
      console.log('Clean hash untuk nama file:', cleanHash);
      
      // Buat file PDF dengan nama hash yang benar
      const pdfFile = new File([pdfWithQR], `${cleanHash}.pdf`, { 
        type: 'application/pdf',
        lastModified: new Date().getTime()
      });
      console.log('File PDF dibuat dengan nama:', pdfFile.name);
      
      // Siapkan FormData dengan informasi yang benar
      const formData = new FormData();
      
      // PENTING: Tambahkan hash terlebih dahulu sebelum file
      formData.append('hash', cleanHash);
      formData.append('file', pdfFile);
      formData.append('signature', signature);
      formData.append('signer', account);
      
      console.log('Mengirim formData ke server dengan data:', {
        fileName: pdfFile.name,
        fileSize: pdfFile.size,
        hash: cleanHash,
        signer: account
      });
      
      // Log semua entry di FormData untuk debugging
      for (const pair of formData.entries()) {
        console.log(`${pair[0]}: ${pair[0] === 'file' ? pair[1].name : pair[1]}`);
      }
      
      // Kirim dengan timeout yang cukup
      const response = await axios.post(`${API_URL}/api/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        timeout: 30000 // 30 detik
      });
      
      console.log('Server response:', response.data);
      
      if (response.data.success) {
        // Tampilkan URL sertifikat yang dapat dibagikan
        const certificateUrl = `${window.location.origin}/certificate/${cleanHash}`;
        setStatus(`Dokumen berhasil ditandatangani! URL Sertifikat: ${certificateUrl}`);
        
        // Tambahkan ke daftar dokumen
      setDocuments([...documents, {
        name: file.name,
          hash: newHash,
        signature,
          timestamp: new Date().toISOString(),
          url: certificateUrl,
          txHash: '' // Akan diisi setelah disimpan ke blockchain
        }]);
        
        // Tampilkan notifikasi sukses
        alert(`Dokumen berhasil ditandatangani!\nURL Sertifikat: ${certificateUrl}`);
      } else {
        setStatus('Terjadi kesalahan: ' + (response.data.error || 'Upload gagal'));
      }
    } catch (error) {
      console.error('Error menandatangani dokumen:', error);
      setStatus('Error menandatangani dokumen: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const storeSignature = async () => {
    if (!signature) {
      setStatus('Silakan tandatangani dokumen terlebih dahulu');
      return;
    }

    try {
      setLoading(true);
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contract = new ethers.Contract(
        CONTRACT_ADDRESS,
        ['function storeSignature(bytes32,bytes)'],
        signer
      );

      // Eksekusi transaksi blockchain
      setStatus('Mengirim transaksi ke blockchain...');
      const tx = await contract.storeSignature(hash, signature);
      
      // Simpan tx hash sementara
      const txHash = tx.hash;
      console.log('Transaction hash:', txHash);
      
      // Gunakan fungsi sinkronisasi untuk konsistensi data di seluruh aplikasi
      await syncTransactionHash(hash, txHash);
      
      // Tampilkan informasi transaksi
      setStatus(`Transaksi terkirim! Transaction hash: ${txHash}`);
      
      // Tunggu transaksi dikonfirmasi
      setStatus('Menunggu konfirmasi transaksi...');
      const receipt = await tx.wait();
      console.log('Transaction receipt:', receipt);
      
      setStatus('Tanda tangan berhasil disimpan di blockchain!');
      
      // Refresh dokumen setelah penyimpanan berhasil
      await loadDocumentsHistory();
    } catch (error) {
      console.error('Error storing signature:', error);
      setStatus('Error menyimpan tanda tangan: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const verifySignature = async () => {
    try {
      setLoading(true);
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const contract = new ethers.Contract(
        CONTRACT_ADDRESS,
        ['function verifySignature(address,bytes32,bytes) returns (bool)'],
        provider
      );

      const result = await contract.verifySignature(account, hash, signature);
      setVerificationResult(result);
      setShowModal(true);
    } catch (error) {
      setStatus('Error verifikasi tanda tangan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Router>
      <Routes>
        <Route path="/certificate/:hash" element={<CertificatePage />} />
        <Route path="/" element={<MainApp 
          file={file}
          setFile={setFile}
          hash={hash}
          setHash={setHash}
          signature={signature}
          setSignature={setSignature}
          status={status}
          setStatus={setStatus}
          account={account}
          setAccount={setAccount}
          balance={balance}
          setBalance={setBalance}
          network={network}
          setNetwork={setNetwork}
          showModal={showModal}
          setShowModal={setShowModal}
          verificationResult={verificationResult}
          setVerificationResult={setVerificationResult}
          loading={loading}
          setLoading={setLoading}
          documents={documents}
          setDocuments={setDocuments}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          connectWallet={connectWallet}
          handleFileUpload={handleFileUpload}
          generateHash={generateHash}
          signDocument={signDocument}
          storeSignature={storeSignature}
          verifySignature={verifySignature}
          loadDocumentsHistory={loadDocumentsHistory}
        />} />
      </Routes>
    </Router>
  );
}

// Main Application UI
function MainApp({
  file, setFile, hash, setHash, signature, setSignature, status, setStatus,
  account, balance, network, showModal, setShowModal, verificationResult,
  loading, documents, activeTab, setActiveTab, connectWallet, handleFileUpload,
  signDocument, storeSignature, verifySignature, loadDocumentsHistory
}) {
  return (
    <div className="App">
      <Navbar bg="dark" variant="dark" expand="lg" className="mb-4">
        <Container>
          <Navbar.Brand href="#home">Digital Signature Blockchain</Navbar.Brand>
          <Navbar.Toggle aria-controls="basic-navbar-nav" />
          <Navbar.Collapse id="basic-navbar-nav">
            <Nav className="me-auto">
              <Nav.Link active={activeTab === 'sign'} onClick={() => setActiveTab('sign')}>Tanda Tangan</Nav.Link>
              <Nav.Link active={activeTab === 'verify'} onClick={() => setActiveTab('verify')}>Verifikasi</Nav.Link>
              <Nav.Link active={activeTab === 'history'} onClick={() => {
                setActiveTab('history');
                loadDocumentsHistory(); // Load riwayat dokumen saat tab diklik
              }}>Riwayat</Nav.Link>
            </Nav>
            {!account ? (
              <Button variant="outline-light" onClick={connectWallet}>
                Hubungkan MetaMask
              </Button>
            ) : (
              <div className="wallet-info">
                <Badge bg="info" className="me-2">{network}</Badge>
                <Badge bg="success">{balance} ETH</Badge>
                <span className="ms-2 text-light">{account.slice(0, 6)}...{account.slice(-4)}</span>
              </div>
            )}
          </Navbar.Collapse>
        </Container>
      </Navbar>

      <Container>
        {loading && (
          <div className="loading-overlay">
            <Spinner animation="border" variant="primary" />
          </div>
        )}

        {status && (
          <Alert variant="info" className="mt-3">
            {status}
          </Alert>
        )}

        {activeTab === 'sign' && (
          <Card className="mb-4">
            <Card.Header>
              <h3>Tanda Tangan Dokumen</h3>
            </Card.Header>
            <Card.Body>
              <Form>
                <Form.Group className="mb-3">
                  <Form.Label>Unggah Dokumen</Form.Label>
                  <Form.Control 
                    type="file" 
                    onChange={handleFileUpload}
                    accept=".pdf,.txt"
                  />
                </Form.Group>

                {file && (
                  <Card className="mb-3">
                    <Card.Body>
                      <h5>Informasi Dokumen</h5>
                      <p>Nama: {file.name}</p>
                      <p>Ukuran: {(file.size / 1024).toFixed(2)} KB</p>
                      <p>Tipe: {file.type}</p>
                    </Card.Body>
                  </Card>
                )}

                {hash && (
                  <Form.Group className="mb-3">
                    <Form.Label>Hash Dokumen</Form.Label>
                    <Form.Control 
                      type="text" 
                      value={hash} 
                      readOnly 
                      className="hash-input"
                    />
                  </Form.Group>
                )}

                {hash && !signature && (
                  <Button 
                    variant="primary" 
                    onClick={signDocument} 
                    className="mb-3"
                    disabled={loading}
                  >
                    Tandatangani Dokumen
                  </Button>
                )}

                {signature && (
                  <>
                    <Form.Group className="mb-3">
                      <Form.Label>Tanda Tangan</Form.Label>
                      <Form.Control 
                        type="text" 
                        value={signature} 
                        readOnly 
                        className="signature-input"
                      />
                    </Form.Group>
                    <div className="d-grid gap-2">
                      <Button 
                        variant="success" 
                        onClick={storeSignature}
                        disabled={loading}
                      >
                        Simpan ke Blockchain
                      </Button>
                      <Button 
                        variant="info" 
                        onClick={verifySignature}
                        disabled={loading}
                      >
                        Verifikasi Tanda Tangan
                      </Button>
                    </div>
                  </>
                )}
              </Form>
            </Card.Body>
          </Card>
        )}

        {activeTab === 'verify' && (
          <Card className="mb-4">
            <Card.Header>
              <h3>Verifikasi Tanda Tangan</h3>
            </Card.Header>
            <Card.Body>
              <Form>
                <Form.Group className="mb-3">
                  <Form.Label>Hash Dokumen</Form.Label>
                  <Form.Control 
                    type="text" 
                    placeholder="Masukkan hash dokumen"
                    value={hash}
                    onChange={(e) => setHash(e.target.value)}
                  />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Tanda Tangan</Form.Label>
                  <Form.Control 
                    type="text" 
                    placeholder="Masukkan tanda tangan"
                    value={signature}
                    onChange={(e) => setSignature(e.target.value)}
                  />
                </Form.Group>
                <Button 
                  variant="primary" 
                  onClick={verifySignature}
                  disabled={loading}
                >
                  Verifikasi
                </Button>
              </Form>
            </Card.Body>
          </Card>
        )}

        {activeTab === 'history' && (
          <Card className="mb-4">
            <Card.Header>
              <h3>Riwayat Dokumen</h3>
            </Card.Header>
            <Card.Body>
              {documents.length === 0 ? (
                <Alert variant="info">
                  {account ? 'Belum ada dokumen yang ditandatangani' : 'Silakan hubungkan wallet untuk melihat riwayat'}
                </Alert>
              ) : (
                <div className="document-list">
                  {documents.map((doc, index) => (
                    <Card key={index} className="mb-3">
                      <Card.Body>
                        <h5>{doc.name}</h5>
                        <div className="mb-3">
                          <div className="d-flex justify-content-between">
                            <strong>Hash Dokumen:</strong>
                            <Button
                              variant="link"
                              size="sm"
                              className="text-muted p-0"
                              onClick={() => navigator.clipboard.writeText(doc.hash)}
                            >
                              <i className="fas fa-copy"></i>
                            </Button>
                          </div>
                          <code className="small d-block text-break bg-light p-2 rounded">{doc.hash.substring(0, 20)}...{doc.hash.substring(doc.hash.length - 5)}</code>
                        </div>
                        
                        {/* Transaction Hash dengan getCorrectTxHash */}
                        <div className="mb-3">
                          <div className="d-flex justify-content-between">
                            <strong>Transaction Hash:</strong>
                            <Button
                              variant="link"
                              size="sm"
                              className="text-muted p-0"
                              onClick={() => navigator.clipboard.writeText(getCorrectTxHash(doc.hash, doc.txHash || ''))}
                            >
                              <i className="fas fa-copy"></i>
                            </Button>
                          </div>
                          {getCorrectTxHash(doc.hash, doc.txHash || '') ? (
                            <div className="d-flex justify-content-between align-items-center bg-light p-2 rounded">
                              <code className="small text-break me-2">
                                {formatHash(getCorrectTxHash(doc.hash, doc.txHash || ''))}
                              </code>
                              <a 
                                href={`https://sepolia.etherscan.io/tx/${getCorrectTxHash(doc.hash, doc.txHash || '')}`} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="btn btn-sm btn-outline-primary"
                              >
                                <i className="fas fa-external-link-alt"></i>
                              </a>
                            </div>
                          ) : (
                            <p className="text-danger">Transaction hash tidak tersedia</p>
                          )}
                        </div>
                        
                        <p>
                          <i className="fas fa-calendar-alt me-2"></i>
                          Ditandatangani pada: {new Date(doc.timestamp).toLocaleString()}
                        </p>
                        
                        <div className="d-flex justify-content-between mt-3">
                          <Button 
                            variant="primary" 
                            size="sm"
                            onClick={() => {
                              const url = doc.url || `${window.location.origin}/certificate/${doc.hash}`;
                              window.open(url, '_blank');
                            }}
                          >
                            <i className="fas fa-certificate me-1"></i>
                            Lihat Sertifikat
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              const url = doc.url || `${window.location.origin}/certificate/${doc.hash}`;
                              navigator.clipboard.writeText(url);
                              setStatus('URL Sertifikat berhasil disalin ke clipboard');
                            }}
                          >
                            <i className="fas fa-copy me-1"></i>
                            Salin URL
                          </Button>
                        </div>
                      </Card.Body>
                    </Card>
                  ))}
                </div>
              )}
            </Card.Body>
          </Card>
        )}
      </Container>

      <Modal show={showModal} onHide={() => setShowModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Hasil Verifikasi</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {verificationResult ? (
            <Alert variant="success">
              Tanda tangan valid dan terverifikasi di blockchain
            </Alert>
          ) : (
            <Alert variant="danger">
              Tanda tangan tidak valid atau tidak ditemukan di blockchain
            </Alert>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>
            Tutup
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

export default App; 