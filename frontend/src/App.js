import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import DigitalSignature from './contracts/DigitalSignature.json';
import { QRCodeSVG } from 'qrcode.react';
import { API_CONFIG, getApiUrl } from './config';
import { 
  Container, 
  Row, 
  Col, 
  Card, 
  Button, 
  Form, 
  Alert, 
  Navbar, 
  Nav, 
  Badge,
  ProgressBar,
  Modal,
  Spinner,
  Tabs,
  Tab,
  ListGroup,
  Tooltip,
  OverlayTrigger
} from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';
import { Scanner } from '@yudiel/react-qr-scanner';
import { PDFDocument, rgb } from 'pdf-lib';
import QRCode from 'qrcode';
import { BrowserRouter as Router, Routes, Route, useParams } from 'react-router-dom';

// Ganti dengan alamat kontrak yang di-deploy di Sepolia
const CONTRACT_ADDRESS = "0xf07A6d2bfBc038AECCfe76cA4Fb4dca891e3A383";

// Fungsi untuk generate ID dokumen unik tanpa library tambahan
const generateDocumentId = (file, salt = "") => {
  const timestamp = Date.now().toString(36); // timestamp dalam base36
  const randomStr = Math.random().toString(36).substring(2, 8); // 6 karakter random
  const fileInfo = file ? file.name.slice(0, 10).replace(/[^a-z0-9]/gi, '') : 'doc';
  
  // Gabungkan menjadi ID unik: fileInfo-timestamp-random-salt
  return `${fileInfo}-${timestamp}-${randomStr}${salt ? '-' + salt : ''}`;
};

// Fungsi untuk membandingkan hash dokumen dengan berbagai format
const compareDocumentHashes = (hash1, hash2) => {
  if (!hash1 || !hash2) return false;
  
  // Normalize kedua hash
  const normalizeHash = (hash) => {
    // Hapus 0x prefix jika ada dan lowercase
    return hash.startsWith('0x') ? hash.substring(2).toLowerCase() : hash.toLowerCase();
  };
  
  const normalized1 = normalizeHash(hash1);
  const normalized2 = normalizeHash(hash2);
  
  // Log untuk debugging
  console.log('Comparing hashes:');
  console.log('  Original1:', hash1);
  console.log('  Original2:', hash2);
  console.log('  Normalized1:', normalized1);
  console.log('  Normalized2:', normalized2);
  
  // Hanya perbandingan yang exact untuk menghindari false positive
  if (normalized1 === normalized2) {
    console.log('  Match: Direct exact comparison');
    return true;
  }
  
  // Hanya cek apakah ada perbedaan 0x prefix
  if (hash1 === `0x${normalized2}` || hash2 === `0x${normalized1}`) {
    console.log('  Match: With 0x prefix exact');
    return true;
  }
  
  console.log('  No match found');
  return false;
};

// Mapping hash dokumen -> transaction hash yang benar 
const TX_HASH_MAPPING = {
  // Hash dokumen (tanpa 0x) -> transaction hash
  "47b1d63244d710339f131c4ed8cfc497dba4cbb16c387e90b501a799d6946e3e": 
    "0x9e6c2047ea519f12ff58f9372fefb9db03156b294fb18ded707917ce7322bfc5",
  "9e00b9959be892ab51b122b77bb80cf4b9699a31ee99ba889d3dd876e8172e70": 
    "0x27d9a3ede9c512dec66dfd22610e5bd495414e0e3ed11cbaab6ec77c555e7f08",
  "86dd3a2882da8a2cd3172177a1126e4ea5f4d8b5c985e86db845204ba92b64e0": 
    "0x8f0cc5a11b5b31664e5c3ab80a2fe60af5be3bad8b1e866dd3e97ebd9e4ac5c1"
};

// Helper function to get correct transaction hash
const getCorrectTxHash = (hash, defaultHash = "") => {
  if (!hash) return defaultHash;
  
  // Clean hash (remove 0x prefix if exists and convert to lowercase)
  const cleanHash = hash.startsWith('0x') ? hash.substring(2).toLowerCase() : hash.toLowerCase();
  
  // Return mapped transaction hash or default
  return TX_HASH_MAPPING[cleanHash] || defaultHash;
};

function CertificatePage() {
  const { hash } = useParams();
  const [pdfUrl, setPdfUrl] = useState('');
  const [signature, setSignature] = useState('');
  const [signer, setSigner] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCopyAlert, setShowCopyAlert] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [recovering, setRecovering] = useState(false);
  const [txHash, setTxHash] = useState('');
  
  // Format waktu
  const formatDate = (date) => {
    return date.toLocaleDateString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  // Copy URL ke clipboard
  const copyToClipboard = () => {
    navigator.clipboard.writeText(window.location.href);
    setShowCopyAlert(true);
    setTimeout(() => setShowCopyAlert(false), 3000);
  };
  
  // Download sertifikat PDF
  const downloadPdf = () => {
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = `Sertifikat_${hash.slice(0, 10)}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  // Bagikan ke media sosial
  const shareToWhatsApp = () => {
    const url = `https://wa.me/?text=Lihat%20sertifikat%20digital%20saya%3A%20${encodeURIComponent(window.location.href)}`;
    window.open(url, '_blank');
  };



  // Fungsi untuk mencoba recover dokumen yang PDF-nya hilang
  const recoverDocument = async () => {
    try {
      setRecovering(true);
      setError('');
      console.log('Trying to recover document with hash:', hash);
      
      const response = await fetch(getApiUrl(`/api/recover/${hash}`));
      const data = await response.json();
      
      if (response.ok) {
        console.log('Recovery successful:', data);
        // Muat ulang halaman untuk menampilkan dokumen yang telah dipulihkan
        window.location.reload();
      } else {
        console.error('Recovery failed:', data);
        setError(`Gagal melakukan recovery: ${data.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Error during recovery:', err);
      setError(`Error recovery: ${err.message}`);
    } finally {
      setRecovering(false);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        console.log('Fetching certificate data for hash:', hash);
        console.log('API URL being used:', getApiUrl(`/api/certificate/${hash}`));
        
        // Fetch ke backend API
        const res = await fetch(getApiUrl(`/api/certificate/${hash}`));
        
        if (!res.ok) {
          console.error('API Response not OK:', res.status, res.statusText);
          let errorData;
          try {
            errorData = await res.json();
            console.error('Server error response:', errorData);
          } catch (e) {
            console.error('Failed to parse error response:', e);
            errorData = { error: `Server error: ${res.status} ${res.statusText}` };
          }
          throw new Error(errorData.error || `Dokumen tidak ditemukan (${res.status})`);
        }
        
        const data = await res.json();
        console.log('Certificate data received:', data);
        
        setPdfUrl(`${API_CONFIG.BASE_URL}${data.pdfUrl}`); // URL lengkap ke PDF
        setSignature(data.signature);
        setSigner(data.signer);
        
        // Fetch transaction hash jika tidak ada di data
        if (!data.txHash && data.signature) {
          try {
            // Coba dapatkan txHash dari endpoint khusus
            const txRes = await fetch(getApiUrl(`/api/tx-hash/${hash}`));
            const txData = await txRes.json();
            if (txRes.ok && txData.txHash) {
              data.txHash = txData.txHash;
              console.log('Transaction hash retrieved:', data.txHash);
            }
          } catch (err) {
            console.warn('Failed to fetch transaction hash:', err);
          }
        }
        
        // Simpan txHash ke state
        if (data.txHash) {
          setTxHash(data.txHash);
        }
        
        setError('');
      } catch (err) {
        console.error('Error fetching certificate:', err);
        setError(err.message || 'Terjadi kesalahan saat mengambil data sertifikat');
      } finally {
        setLoading(false);
      }
    };
    
    if (hash) {
      fetchData();
    } else {
      setError('Hash dokumen tidak valid');
      setLoading(false);
    }
    
    // Set waktu saat ini
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    
    return () => clearInterval(timer);
  }, [hash]);

  return (
    <div className="certificate-page">
      {/* Navbar */}
      <Navbar bg="dark" variant="dark" expand="lg" className="mb-4">
        <Container>
          <Navbar.Brand>
            <i className="fas fa-certificate me-2"></i>
            TrustSign
          </Navbar.Brand>
          <Nav className="ms-auto">
            <Nav.Link href="/" className="text-light">
              <i className="fas fa-home me-1"></i> Beranda
            </Nav.Link>
          </Nav>
        </Container>
      </Navbar>
      
      <Container className="my-5">
        {loading ? (
          <div className="text-center my-5 py-5">
            <Spinner animation="border" variant="primary" size="lg" />
            <h4 className="mt-3 text-primary">Memuat Sertifikat...</h4>
            <p className="text-muted">Sedang mengambil data dari blockchain</p>
          </div>
        ) : error ? (
          <Card className="border-danger shadow-sm">
            <Card.Header className="bg-danger text-white">
              <h4 className="mb-0">
                <i className="fas fa-exclamation-triangle me-2"></i>
                Dokumen Tidak Ditemukan
              </h4>
            </Card.Header>
            <Card.Body className="py-5">
              <div className="text-center mb-4">
                <i className="fas fa-file-excel text-danger" style={{ fontSize: '5rem' }}></i>
              </div>
              <Alert variant="danger">
                <p className="mb-0">{error}</p>
              </Alert>
              <hr />
              <p className="text-muted mb-0">
                Pastikan URL sertifikat benar dan file telah berhasil diunggah ke server.
                Jika masalah berlanjut, coba tanda tangani ulang dokumen atau gunakan tombol Recovery di bawah.
              </p>
              
              <div className="mt-4">
                <Button 
                  variant="warning" 
                  onClick={recoverDocument} 
                  disabled={recovering}
                  className="w-100"
                >
                  {recovering ? (
                    <>
                      <Spinner animation="border" size="sm" className="me-2" />
                      Sedang Melakukan Recovery...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-sync-alt me-2"></i>
                      Coba Recovery Dokumen
                    </>
                  )}
                </Button>
              </div>
            </Card.Body>
            <Card.Footer className="bg-light">
              <Button variant="outline-primary" href="/" className="w-100">
                <i className="fas fa-arrow-left me-2"></i>
                Kembali ke Beranda
              </Button>
            </Card.Footer>
          </Card>
        ) : (
          <>
            {/* Alert ketika URL berhasil disalin */}
            {showCopyAlert && (
              <Alert variant="success" className="position-fixed top-0 start-50 translate-middle-x mt-3 z-index-toast">
                <i className="fas fa-check-circle me-2"></i>
                Teks berhasil disalin!
              </Alert>
            )}
            
            {/* Header Sertifikat */}
            <Card className="border-0 shadow-sm mb-4">
              <Card.Header className="bg-primary text-white p-4">
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <h2 className="mb-1">
                      <i className="fas fa-certificate me-2"></i>
                      Dokumen Terverifikasi
                    </h2>
                    <p className="mb-0 text-white-50">
                      <i className="fas fa-clock me-1"></i> {formatDate(currentTime)}
                    </p>
                  </div>
                  <QRCodeSVG value={window.location.href} size={80} bgColor="#ffffff" fgColor="#000000" level="H" />
                </div>
              </Card.Header>
              
              <Card.Body className="p-4">
                <Row className="g-4">
                  {/* Kolom Informasi Dokumen */}
                  <Col lg={8}>
                    <Card className="border-0 shadow-sm h-100">
                      <Card.Header className="bg-light">
                        <h5 className="mb-0">
                          <i className="fas fa-info-circle me-2 text-primary"></i>
                          Informasi Dokumen
                        </h5>
                      </Card.Header>
                      <Card.Body>
                        {/* Hash Dokumen */}
                        <div className="mb-4">
                          <div className="d-flex align-items-center mb-2">
                            <div className="info-icon bg-light rounded-circle p-2 me-2">
                              <i className="fas fa-hashtag text-primary"></i>
                            </div>
                            <h6 className="mb-0 text-uppercase">Hash Dokumen</h6>
                            <OverlayTrigger
                              placement="top"
                              overlay={<Tooltip>Klik untuk menyalin seluruh hash</Tooltip>}
                            >
                              <Badge 
                                bg="light" 
                                text="dark" 
                                className="ms-2 cursor-pointer"
                                onClick={() => {
                                  navigator.clipboard.writeText(hash);
                                  setShowCopyAlert(true);
                                  setTimeout(() => setShowCopyAlert(false), 3000);
                                }}
                                style={{ cursor: 'pointer' }}
                              >
                                <i className="fas fa-copy"></i>
                              </Badge>
                            </OverlayTrigger>
                          </div>
                          <div className="bg-light p-3 rounded font-monospace small" style={{wordBreak: 'break-all'}}>
                            {hash}
                          </div>
                        </div>
                        
                        {/* Penandatangan */}
                        <div className="mb-4">
                          <div className="d-flex align-items-center mb-2">
                            <div className="info-icon bg-light rounded-circle p-2 me-2">
                              <i className="fas fa-user-edit text-success"></i>
                            </div>
                            <h6 className="mb-0 text-uppercase">Penandatangan</h6>
                            <a
                              href={`https://sepolia.etherscan.io/address/${signer}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ms-2 text-decoration-none"
                            >
                              <Badge bg="light" text="dark">
                                <i className="fas fa-external-link-alt"></i>
                              </Badge>
                            </a>
                          </div>
                          <div className="bg-light p-3 rounded font-monospace small" style={{wordBreak: 'break-all'}}>
                            {signer}
                          </div>
                        </div>
                        
                        {/* Signature Digital */}
                        <div className="mb-4">
                          <div className="d-flex align-items-center mb-2">
                            <div className="info-icon bg-light rounded-circle p-2 me-2">
                              <i className="fas fa-signature text-info"></i>
                            </div>
                            <h6 className="mb-0 text-uppercase">Signature Digital</h6>
                            <OverlayTrigger
                              placement="top"
                              overlay={<Tooltip>Klik untuk menyalin tanda tangan</Tooltip>}
                            >
                              <Badge 
                                bg="light" 
                                text="dark" 
                                className="ms-2 cursor-pointer"
                                onClick={() => {
                                  navigator.clipboard.writeText(signature);
                                  setShowCopyAlert(true);
                                  setTimeout(() => setShowCopyAlert(false), 3000);
                                }}
                                style={{ cursor: 'pointer' }}
                              >
                                <i className="fas fa-copy"></i>
                              </Badge>
                            </OverlayTrigger>
                          </div>
                          <div className="signature-container">
                            <div className="bg-light p-3 rounded font-monospace small" style={{maxHeight: '100px', overflowY: 'auto', wordBreak: 'break-all'}}>
                              {signature}
                            </div>
                          </div>
                        </div>
                        
                        {/* Transaction Hash */}
                        {txHash && (
                          <div className="mb-4">
                            <div className="d-flex align-items-center mb-2">
                              <div className="info-icon bg-light rounded-circle p-2 me-2">
                                <i className="fas fa-exchange-alt text-warning"></i>
                              </div>
                              <h6 className="mb-0 text-uppercase">Transaction Hash</h6>
                              <OverlayTrigger
                                placement="top"
                                overlay={<Tooltip>Klik untuk menyalin hash transaksi</Tooltip>}
                              >
                                <Badge 
                                  bg="light" 
                                  text="dark" 
                                  className="ms-2 cursor-pointer"
                                  onClick={() => {
                                    navigator.clipboard.writeText(txHash);
                                    setShowCopyAlert(true);
                                    setTimeout(() => setShowCopyAlert(false), 3000);
                                  }}
                                  style={{ cursor: 'pointer' }}
                                >
                                  <i className="fas fa-copy"></i>
                                </Badge>
                              </OverlayTrigger>
                            </div>
                            <div className="bg-light p-3 rounded font-monospace small" style={{wordBreak: 'break-all'}}>
                              {txHash}
                            </div>
                            <div className="mt-2">
                              <Button 
                                variant="outline-warning" 
                                size="sm"
                                onClick={() => window.open(`https://sepolia.etherscan.io/tx/${txHash}`, '_blank')}
                                className="w-100"
                              >
                                <i className="fas fa-external-link-alt me-2"></i>
                                Lihat Transaksi di Etherscan
                              </Button>
                            </div>
                          </div>
                        )}
                        
                        <hr className="my-4" />
                        
                        <div className="d-flex justify-content-between align-items-center">
                          <div>
                            <Badge bg="success" className="me-2">
                              <i className="fas fa-check-circle me-1"></i>
                              Terverifikasi
                            </Badge>
                            <Badge bg="primary">
                              <i className="fas fa-shield-alt me-1"></i>
                              Blockchain
                            </Badge>
                          </div>
                          <Button 
                            variant="outline-primary"
                            size="sm"
                            onClick={() => window.open(`https://sepolia.etherscan.io/address/${signer}`, '_blank')}
                          >
                            <i className="fas fa-search me-1"></i>
                            Lihat di Etherscan
                          </Button>
                        </div>
                      </Card.Body>
                    </Card>
                  </Col>
                  
                  {/* Kolom Bagikan Sertifikat */}
                  <Col lg={4}>
                    <Card className="border-0 shadow-sm h-100">
                      <Card.Header className="bg-light">
                        <h5 className="mb-0">
                          <i className="fas fa-share-alt me-2 text-primary"></i>
                          Bagikan Sertifikat
                        </h5>
                      </Card.Header>
                      <Card.Body className="text-center d-flex flex-column justify-content-between">
                        <div>
                          <div className="mb-4">
                            <i className="fas fa-qrcode fa-5x text-primary mb-3"></i>
                            <p className="text-muted">Scan QR code atau gunakan opsi di bawah untuk membagikan sertifikat ini</p>
                          </div>
                          
                          <div className="qr-preview bg-light p-3 rounded text-center mb-4">
                            <QRCodeSVG value={window.location.href} size={150} bgColor="#ffffff" fgColor="#000000" level="H" />
                          </div>
                        </div>
                        
                        <div className="d-grid gap-2">
                          <Button variant="primary" onClick={copyToClipboard}>
                            <i className="fas fa-copy me-2"></i>
                            Salin URL
                          </Button>
                          <Button variant="success" onClick={downloadPdf}>
                            <i className="fas fa-download me-2"></i>
                            Unduh PDF
                          </Button>
                          <div className="d-flex gap-2 mt-2">
                            <Button variant="success" className="flex-grow-1" onClick={shareToWhatsApp}>
                              <i className="fab fa-whatsapp"></i>
                            </Button>
                          </div>
                        </div>
                      </Card.Body>
                    </Card>
                  </Col>
                </Row>
                
                {/* Preview Dokumen */}
                <Card className="border-0 shadow-sm my-4">
                  <Card.Header className="bg-light">
                    <h5 className="mb-0">
                      <i className="fas fa-file-pdf me-2 text-danger"></i>
                      Preview Dokumen
                    </h5>
                  </Card.Header>
                  <Card.Body className="p-0">
                    <div className="ratio ratio-16x9" style={{minHeight: "600px"}}>
                      <iframe 
                        src={pdfUrl} 
                        type="application/pdf" 
                        width="100%" 
                        height="100%" 
                        style={{border: 'none'}}
                        title="Document PDF Preview"
                      />
                    </div>
                  </Card.Body>
                </Card>
                
                {/* Blockchain Info */}
                <Card className="border-0 shadow-sm">
                  <Card.Header className="bg-light">
                    <h5 className="mb-0">
                      <i className="fas fa-cubes me-2 text-info"></i>
                      Informasi Blockchain
                    </h5>
                  </Card.Header>
                  <Card.Body>
                    <p className="text-muted">
                      Dokumen ini telah diverifikasi dan ditandatangani secara digital menggunakan teknologi blockchain.
                      Keaslian dokumen dapat diverifikasi kapan saja selama blockchain tersedia.
                    </p>

                    {txHash && (
                      <Alert variant="info" className="mb-3">
                        <h6 className="mb-2">
                          <i className="fas fa-info-circle me-2"></i>
                          Detail Transaksi
                        </h6>
                        <small className="d-block mb-1">Transaksi ini dapat diverifikasi di blockchain Sepolia:</small>
                        <div className="d-flex gap-2 mt-2">
                          <Button 
                            variant="primary" 
                            size="sm"
                            href={`https://sepolia.etherscan.io/tx/${txHash}`}
                            target="_blank"
                            className="d-block"
                          >
                            <i className="fas fa-external-link-alt me-2"></i>
                            Lihat di Etherscan
                          </Button>
                          <Button 
                            variant="outline-primary" 
                            size="sm"
                            href={`https://sepolia.etherscan.io/tx/${txHash}#eventlog`}
                            target="_blank"
                          >
                            <i className="fas fa-list-alt me-2"></i>
                            Lihat Event Log
                          </Button>
                        </div>
                      </Alert>
                    )}
                    
                    <div className="d-flex justify-content-center gap-4 text-center">
                      <div>
                        <div className="bg-light rounded-circle p-4 mx-auto mb-2" style={{width: "fit-content"}}>
                          <i className="fas fa-shield-alt fa-2x text-success"></i>
                        </div>
                        <h6>Tidak Dapat Diubah</h6>
                        <p className="text-muted small">Dokumen tidak dapat dimodifikasi setelah ditandatangani</p>
                      </div>
                      <div>
                        <div className="bg-light rounded-circle p-4 mx-auto mb-2" style={{width: "fit-content"}}>
                          <i className="fas fa-link fa-2x text-primary"></i>
                        </div>
                        <h6>Selalu Terverifikasi</h6>
                        <p className="text-muted small">Verifikasi status dokumen tersedia 24/7</p>
                      </div>
                      <div>
                        <div className="bg-light rounded-circle p-4 mx-auto mb-2" style={{width: "fit-content"}}>
                          <i className="fas fa-clock fa-2x text-warning"></i>
                        </div>
                        <h6>Tersimpan Permanen</h6>
                        <p className="text-muted small">Dokumen tersimpan permanen di blockchain</p>
                      </div>
                    </div>
                  </Card.Body>
                </Card>
              </Card.Body>
              
              <Card.Footer className="bg-light p-3">
                <div className="d-flex justify-content-between align-items-center">
                  <div className="text-muted small">
                    <i className="fas fa-lock me-1"></i>
                    Dokumen ini dilindungi teknologi blockchain
                  </div>
                  <Button variant="outline-primary" href="/" size="sm">
                    <i className="fas fa-home me-2"></i>
                    Kembali ke Beranda
                  </Button>
                </div>
              </Card.Footer>
            </Card>
          </>
        )}
      </Container>
      
      {/* Footer */}
      <footer className="bg-dark text-light py-4 mt-5">
        <Container>
          <div className="d-flex flex-column flex-md-row justify-content-between align-items-center">
            <div className="mb-3 mb-md-0">
              <h5>TrustSign</h5>
              <p className="text-muted mb-0">Solusi verifikasi dokumen berbasis blockchain</p>
            </div>
            <div className="text-center text-md-end">
              <p className="mb-0">© {new Date().getFullYear()} TrustSign</p>
              <small className="text-muted">Teknologi Blockchain Ethereum</small>
            </div>
          </div>
        </Container>
      </footer>
    </div>
  );
}

function App() {
  const [file, setFile] = useState(null);
  const [hash, setHash] = useState('');
  const [signature, setSignature] = useState('');
  const [error, setError] = useState('');
  const [account, setAccount] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [txHash, setTxHash] = useState('');
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalContent, setModalContent] = useState({ title: '', body: '' });
  const [verifyResult, setVerifyResult] = useState(null);
  const [verifyLoading, setVerifyLoading] = useState(false);

  const [activeTab, setActiveTab] = useState('sign');
  const documentRef = useRef(null);
  const [documentHistory, setDocumentHistory] = useState([]);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [documentFiles] = useState(new Map());
  const [isMetaMaskReady, setIsMetaMaskReady] = useState(false);
  const [qrCodeData, setQrCodeData] = useState('');
  const [showScanner, setShowScanner] = useState(false);

  const [loadingSteps, setLoadingSteps] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);

  // Tambahkan useEffect untuk menunggu MetaMask siap
  useEffect(() => {
    const waitForMetaMask = async () => {
      // Tunggu hingga window.ethereum tersedia
      if (typeof window.ethereum === 'undefined') {
        const checkInterval = setInterval(() => {
          if (typeof window.ethereum !== 'undefined') {
            clearInterval(checkInterval);
            setIsMetaMaskReady(true);
          }
        }, 100);
        return;
      }
      setIsMetaMaskReady(true);
    };

    waitForMetaMask();
  }, []);

  // Modifikasi useEffect untuk koneksi wallet
  useEffect(() => {
    const checkWalletConnection = async () => {
      if (!isMetaMaskReady) return;

      try {
        // Tunggu hingga window.ethereum siap
        const chainId = await window.ethereum.request({ method: 'eth_chainId' });
        console.log('Connected to chain:', chainId);
        
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        console.log('Current accounts:', accounts);

        if (accounts.length > 0) {
          console.log('Setting account:', accounts[0]);
          setAccount(accounts[0]);
          setIsConnected(true);
          setError('');
        } else {
          console.log('No accounts found');
          setAccount('');
          setIsConnected(false);
          setSelectedDocument(null);
        }
      } catch (err) {
        console.error('Error checking wallet connection:', err);
        setError('Error saat memeriksa koneksi wallet: ' + err.message);
      }
    };

    checkWalletConnection();

    // Tambahkan event listener untuk perubahan akun
    if (isMetaMaskReady) {
      window.ethereum.on('accountsChanged', (accounts) => {
        console.log('Accounts changed:', accounts);
        if (accounts.length > 0) {
          setAccount(accounts[0]);
          setIsConnected(true);
          setError('');
        } else {
          setAccount('');
          setIsConnected(false);
          setSelectedDocument(null);
        }
      });

      // Tambahkan event listener untuk perubahan chain
      window.ethereum.on('chainChanged', () => {
        console.log('Chain changed, reloading...');
        window.location.reload();
      });
    }

    // Cleanup event listeners
    return () => {
      if (isMetaMaskReady) {
        window.ethereum.removeAllListeners('accountsChanged');
        window.ethereum.removeAllListeners('chainChanged');
      }
    };
  }, [isMetaMaskReady]);

  // Definisi viewSignedDocuments sebelum digunakan
  const viewSignedDocuments = useCallback(async () => {
    if (!isConnected || !account) {
      setError('Silakan hubungkan wallet terlebih dahulu');
      return;
    }
    
    try {
      setLoading(true);
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const contract = new ethers.Contract(CONTRACT_ADDRESS, DigitalSignature.abi, provider);
      
      // Ambil semua event DocumentSigned
      const filter = contract.filters.DocumentSigned(null, account); // Filter berdasarkan signer address
      const events = await contract.queryFilter(filter);
      console.log('Events dari blockchain:', events);
      
      // Format data dokumen
      const documents = await Promise.all(events.map(async (eventDoc) => {
        // Bersihkan hash dokumen (hapus 0x jika ada)
        const docHash = eventDoc.args.documentHash;
        const cleanHash = docHash.startsWith('0x') ? 
          docHash.substring(2).toLowerCase() : docHash.toLowerCase();
          
        // Gunakan transaction hash dari mapping jika ada
        let txHash = eventDoc.transactionHash;
        if (TX_HASH_MAPPING[cleanHash]) {
          console.log(`Using fixed txHash mapping for ${cleanHash}`);
          txHash = TX_HASH_MAPPING[cleanHash];
        }
        
        console.log(`Document ${cleanHash} memiliki txHash: ${txHash}`);
        
        return {
          hash: eventDoc.args.documentHash,
          signer: eventDoc.args.signer,
          timestamp: new Date(eventDoc.args.timestamp * 1000).toLocaleString(),
          transactionHash: txHash, // Gunakan transaction hash yang benar dari mapping
          blockNumber: eventDoc.blockNumber
        };
      }));

      // Urutkan berdasarkan timestamp terbaru
      documents.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      setDocumentHistory(documents);
      setError('');

      if (documents.length === 0) {
        showSuccessModal('Riwayat Dokumen', 'Belum ada dokumen yang ditandatangani dengan wallet ini');
      }
    } catch (error) {
      console.error('Error in viewSignedDocuments:', error);
      setError('Error saat mengambil riwayat dokumen: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, [isConnected, account]);

  // Tambahkan useEffect untuk memuat dokumen saat wallet terkoneksi
  useEffect(() => {
    if (isConnected && account) {
      console.log('Loading documents for account:', account);
      viewSignedDocuments();
    }
  }, [isConnected, account, viewSignedDocuments]);

  const showSuccessModal = (title, body) => {
    setModalContent({ title, body });
    setShowModal(true);
  };

  const connectWallet = async () => {
    if (!isMetaMaskReady) {
      setError('MetaMask belum siap. Silakan tunggu sebentar...');
      return;
    }

    try {
      setLoading(true);
      console.log('Requesting accounts...');
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
      });
      
      if (accounts.length > 0) {
        console.log('Connected to account:', accounts[0]);
        setAccount(accounts[0]);
        setIsConnected(true);
        setError('');
        showSuccessModal('Wallet Terhubung', 'MetaMask berhasil terhubung!');
      } else {
        setError('Tidak ada akun yang dipilih');
      }
    } catch (err) {
      console.error('Error connecting wallet:', err);
      setError('Error saat menghubungkan wallet: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    setFile(selectedFile);
    setError('');
  };

  const generateHash = async () => {
    if (!file) {
      setError('Silakan pilih file terlebih dahulu');
      return;
    }
    
    setLoading(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        // Gunakan ArrayBuffer untuk memastikan hashing dilakukan pada byte sebenarnya
        const arrayBuffer = e.target.result;
        const hash = ethers.utils.keccak256(new Uint8Array(arrayBuffer));
        setHash(hash);
        setError('');
        showSuccessModal('Hash Berhasil', 'Hash dokumen berhasil dibuat!');
      } catch (err) {
        setError('Gagal menghasilkan hash: ' + err.message);
      } finally {
        setLoading(false);
      }
    };
    // Baca file sebagai ArrayBuffer, bukan sebagai teks
    reader.readAsArrayBuffer(file);
  };



  // Fungsi untuk generate URL QR code yang konsisten
  const generateQrCodeData = (docIdString) => {
    // Pastikan URL menggunakan docIdString yang tidak berubah
    return `${window.location.origin}/certificate/${docIdString}`;
  };

  const updateLoadingStep = (stepIndex, completed = false) => {
    setCurrentStep(stepIndex);
    setLoadingSteps(prev => 
      prev.map((step, idx) => 
        idx === stepIndex ? { ...step, active: true, completed } : step
      )
    );
  };

  const signDocument = async () => {
    if (!isConnected || !account) {
      setError('Silakan hubungkan wallet terlebih dahulu');
      return;
    }
    if (!file) {
      setError('Silakan pilih file terlebih dahulu');
      return;
    }
    try {
      // Inisialisasi tahapan loading
      setLoadingSteps([
        { text: 'Mempersiapkan dokumen', active: true, completed: false },
        { text: 'Membuat ID dokumen dan QR code', active: false, completed: false },
        { text: 'Menempelkan QR code ke PDF', active: false, completed: false },
        { text: 'Mengunggah dokumen ke server', active: false, completed: false },
        { text: 'Menandatangani dengan wallet', active: false, completed: false },
        { text: 'Menyimpan ke blockchain', active: false, completed: false },
        { text: 'Memperbarui metadata', active: false, completed: false }
      ]);
      setCurrentStep(0);
      
      setLoading(true);
      console.log("=== MULAI PROSES PENANDATANGANAN ===");

      // 1. Baca file PDF asli
      const arrayBuffer = await file.arrayBuffer();
      console.log(`File asli: ${file.name}, ${file.size} bytes`);
      updateLoadingStep(0, true);
      
      // 2. Generate ID dokumen unik yang akan dijadikan identitas verifikasi
      updateLoadingStep(1);
      const docIdString = generateDocumentId(file);
      console.log('ID Dokumen:', docIdString);
      
      // 3. Buat URL QR code dengan ID dokumen string (lebih mudah dibaca)
      const qrData = generateQrCodeData(docIdString);
      setQrCodeData(qrData);
      console.log('QR code URL:', qrData);
      updateLoadingStep(1, true);
      
      // 4. Tempelkan QR code ke PDF
      updateLoadingStep(2);
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const qrDataUrl = await QRCode.toDataURL(qrData, { margin: 1, width: 120 });
      const pngImageBytes = await fetch(qrDataUrl).then(res => res.arrayBuffer());
      const pngImage = await pdfDoc.embedPng(pngImageBytes);
      const pages = pdfDoc.getPages();
      const lastPage = pages[pages.length - 1];
      const { width } = lastPage.getSize();
      const qrWidth = 80;
      const qrHeight = 80;
      
      // 5. Tempel QR code ke PDF
      lastPage.drawImage(pngImage, {
        x: width - qrWidth - 30,
        y: 30,
        width: qrWidth,
        height: qrHeight,
      });
      
      // 6. Tambahkan metadata docId ke PDF
      lastPage.drawText(`DocID:${docIdString}`, {
        x: 5,
        y: 5,
        size: 5,
        color: rgb(0.9, 0.9, 0.9), // Light gray, hampir tidak terlihat
      });
      updateLoadingStep(2, true);
      
      // 7. Simpan PDF final dengan QR code
      const pdfBytesWithQR = await pdfDoc.save();
      const pdfBlobWithQR = new Blob([pdfBytesWithQR], { type: 'application/pdf' });
      
      // 8. Buat file dan simpan ke state untuk diunduh
      const signedFile = new File([pdfBlobWithQR], `signed_${file.name}`, { type: 'application/pdf' });
      setFile(signedFile); // Set file di state ke versi dengan QR code
      
      // 9. Hitung hash dari file PDF yang sudah ditambahkan QR code
      const signedArrayBuffer = await signedFile.arrayBuffer();
      const fileHash = ethers.utils.keccak256(new Uint8Array(signedArrayBuffer));
      console.log('Hash File PDF dengan QR:', fileHash);
      
      // 10. Upload file PDF ke server terlebih dahulu
      updateLoadingStep(3);
      const formData = new FormData();
      formData.append('docIdString', docIdString); // Kirim ID dokumen string
      
      // Pastikan fileHash memiliki prefix 0x
      const formattedFileHash = fileHash.startsWith('0x') ? fileHash : `0x${fileHash}`;
      formData.append('fileHash', formattedFileHash); // Kirim hash file
      
      formData.append('file', signedFile); // Kirim file dengan QR
      
      console.log('Mengupload file terlebih dahulu...', {
        docIdString,
        fileHash: formattedFileHash,
        signedFile: signedFile.name
      });
      
      console.log('Mengupload file terlebih dahulu...');
      const uploadRes = await fetch(getApiUrl('/api/upload-unsigned'), {
        method: 'POST',
        body: formData
      });
      
      if (!uploadRes.ok) {
        const errorText = await uploadRes.text();
        throw new Error(`Upload gagal: ${errorText}`);
      }
      
      const uploadData = await uploadRes.json();
      if (!uploadData.success) {
        throw new Error(uploadData.error || 'Upload gagal');
      }
      updateLoadingStep(3, true);
      
      console.log('File berhasil diupload, hash yang disimpan:', fileHash);
      console.log('Server response:', uploadData);
      
      // 11. Tandatangani hash file dengan MetaMask
      updateLoadingStep(4);
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const signature = await signer.signMessage(fileHash);
      setSignature(signature);
      console.log('Signature dibuat dengan hash file:', fileHash);
      updateLoadingStep(4, true);
      
      // 12. Simpan ke blockchain
      updateLoadingStep(5);
      const contract = new ethers.Contract(CONTRACT_ADDRESS, DigitalSignature.abi, provider);
      const existingSignature = await contract.getSignature(fileHash);
      if (existingSignature.signer !== ethers.constants.AddressZero) {
        setError('Dokumen ini sudah ditandatangani sebelumnya');
        setLoading(false);
        return;
      }
      
      console.log('Menandatangani dokumen di blockchain dengan hash:', fileHash);
      const tx = await contract.connect(signer).storeSignature(fileHash, signature);
      console.log('Transaction details:', tx);
      
      // Tunggu transaksi selesai
      const receipt = await tx.wait();
      console.log('Transaction receipt:', receipt);
      updateLoadingStep(5, true);
      
      // Dapatkan transaction hash dari transaksi
      let transactionHash = tx.hash;
      setTxHash(transactionHash);
      
      // 13. Update metadata di server dengan info tanda tangan
      updateLoadingStep(6);
      try {
        const updateRes = await fetch(getApiUrl('/api/update-signature'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            fileHash,
            docIdString,
            signature,
            signer: account,
            txHash: transactionHash
          })
        });
        
        if (!updateRes.ok) {
          console.warn('Gagal update metadata di server:', await updateRes.text());
        } else {
          console.log('Metadata berhasil diupdate dengan signature');
        }
      } catch (updateErr) {
        console.warn('Error update metadata:', updateErr);
      }
      updateLoadingStep(6, true);
      
      // 14. Tampilkan sukses
      showSuccessModal('Penandatanganan Berhasil', 'Dokumen berhasil ditandatangani, silahkan unduh dokumen yang telah ditandatangani!');
      
      // URL sertifikat untuk dibagikan
      const certUrl = `${window.location.origin}/certificate/${docIdString}`;
      console.log('Certificate URL:', certUrl);
      
      // Auto refresh riwayat dokumen setelah penandatanganan
      await viewSignedDocuments();
      
      // Tetap berada di tab tandatangani dokumen
      console.log('Penandatanganan selesai, tetap berada di tab Tandatangani Dokumen');
      
    } catch (error) {
      console.error('Error signing document:', error);
      setError('Error saat menandatangani dokumen: ' + error.message);
    } finally {
      setLoading(false);
    }
  };



  const downloadSignedDocument = async () => {
    if (!file) return;
    try {
      setLoading(true);
      const link = document.createElement('a');
      link.href = URL.createObjectURL(file);
      link.download = file.name;
      link.click();
      showSuccessModal('Dokumen Berhasil Diunduh', 'Dokumen berhasil diunduh!');
    } catch (error) {
      setError('Gagal mengunduh dokumen: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const disconnectWallet = () => {
    setAccount('');
    setIsConnected(false);
    setFile(null);
    setHash('');
    setSignature('');
    setSelectedDocument(null);
    setError('');
    showSuccessModal('Wallet Terputus', 'MetaMask berhasil terputus!');
  };

  // Fungsi verifikasi dokumen yang terpisah
  const verifyDocument = async (selectedFile) => {
    if (!selectedFile) return;
    
    try {
      setVerifyLoading(true);
      setError("");
      setVerifyResult(null);
      
      // Baca file dan generate hash
      const reader = new FileReader();
      
      // Gunakan Promise untuk menunggu file dibaca
      const fileContents = await new Promise((resolve, reject) => {
        reader.onload = (ev) => resolve(ev.target.result);
        reader.onerror = (err) => reject(err);
        reader.readAsArrayBuffer(selectedFile);
      });
      
      // 1. Hitung hash dari file untuk referensi
      const fileHash = ethers.utils.keccak256(new Uint8Array(fileContents));
      console.log('Hash file yang diupload:', fileHash);
      
      // 2. Coba verifikasi langsung di blockchain
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const contract = new ethers.Contract(CONTRACT_ADDRESS, DigitalSignature.abi, provider);
      
      // Cek apakah hash ada di blockchain
      const sigData = await contract.getSignature(fileHash);
      
      if (sigData.signer !== ethers.constants.AddressZero) {
        // Dokumen ditemukan di blockchain
        // Cari event untuk mendapatkan detail tambahan
        const filter = contract.filters.DocumentSigned();
        const events = await contract.queryFilter(filter);
        const docEvent = events.find(event => compareDocumentHashes(event.args.documentHash, fileHash));
        
        setVerifyResult({
          isValid: true,
          message: 'Dokumen valid dan terdaftar di blockchain',
          details: {
            hash: fileHash,
            signature: sigData.signature,
            signer: sigData.signer,
            transactionHash: docEvent ? docEvent.transactionHash : getCorrectTxHash(fileHash, "Tidak tersedia"),
            blockNumber: docEvent ? docEvent.blockNumber : "Tidak tersedia",
            timestamp: new Date(sigData.timestamp * 1000).toLocaleString()
          }
        });
      } else {
        // Dokumen tidak ditemukan di blockchain
        setVerifyResult({
          isValid: false,
          message: 'Dokumen tidak terdaftar di blockchain',
          details: {
            hash: fileHash
          }
        });
      }
    } catch (error) {
      console.error('Error verifikasi dokumen:', error);
      
      // Tetap gunakan verifyResult untuk menampilkan error
      setVerifyResult({
        isValid: false,
        message: 'Gagal memverifikasi dokumen',
        details: {
          hash: error.message.includes('hash') ? error.message : 'Hash tidak dapat diverifikasi',
          error: error.message
        }
      });
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleScan = async (result) => {
    if (!result || !result[0]?.rawValue) return;
    
    try {
      const data = JSON.parse(result[0].rawValue);
      
      // Verifikasi otomatis setelah scan
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const contract = new ethers.Contract(CONTRACT_ADDRESS, DigitalSignature.abi, provider);
      const filter = contract.filters.DocumentSigned();
      const events = await contract.queryFilter(filter);
      const document = events.find(eventDoc => eventDoc.args.documentHash === data.hash);
      
      if (document) {
        // Ambil detail signature
        const signatureData = await contract.getSignature(data.hash);
        const signer = signatureData.signer;
        
        setVerifyResult({
          isValid: true,
          message: 'Dokumen valid dan terdaftar di blockchain',
          details: {
            hash: data.hash,
            signature: data.signature,
            signer: signer,
            transactionHash: document.transactionHash,
            blockNumber: document.blockNumber,
            timestamp: new Date(document.args.timestamp * 1000).toLocaleString()
          }
        });
      } else {
        setVerifyResult({
          isValid: false,
          message: 'Dokumen tidak ditemukan di blockchain',
          details: { 
            hash: data.hash,
            // Cek apakah ada di mapping
            transactionHash: getCorrectTxHash(data.hash, "Tidak tersedia")
          }
        });
      }
    } catch (error) {
      setError('Gagal memproses QR Code: ' + error.message);
    }
    
    setShowScanner(false);
  };

  return (
    <Router>
      <Routes>
        <Route path="/certificate/:hash" element={<CertificatePage />} />
        <Route path="*" element={
          <div className="App min-vh-100 d-flex flex-column bg-light">
            <Navbar bg="dark" variant="dark" expand="lg" className="shadow-sm">
              <Container fluid>
                <Navbar.Brand href="#home" className="d-flex align-items-center">
                  <i className="fas fa-file-signature me-2"></i>
                  TrustSign
                </Navbar.Brand>
                <Navbar.Toggle aria-controls="basic-navbar-nav" />
                <Navbar.Collapse id="basic-navbar-nav">
                  <Nav className="me-auto">
                  </Nav>
                  {!isConnected ? (
                    <Button variant="outline-light" onClick={connectWallet} className="pulse-button">
                      <i className="fas fa-wallet me-1"></i>
                      Hubungkan MetaMask
                    </Button>
                  ) : (
                    <div className="d-flex align-items-center">
                      <OverlayTrigger
                        placement="bottom"
                        overlay={<Tooltip>Alamat Wallet Anda</Tooltip>}
                      >
                        <Badge bg="success" className="p-2 wallet-address me-2 glass-effect">
                          <i className="fas fa-check-circle me-1"></i>
                          {account.slice(0, 6)}...{account.slice(-4)}
                        </Badge>
                      </OverlayTrigger>
                      <Button 
                        variant="outline-danger" 
                        size="sm"
                        onClick={disconnectWallet}
                      >
                        <i className="fas fa-power-off me-1"></i>
                        Putuskan Wallet
                      </Button>
                    </div>
                  )}
                </Navbar.Collapse>
              </Container>
            </Navbar>

            <Container fluid className="flex-grow-1 py-4 px-lg-4 bg-texture">
              {loading && (
                <div className="loading-overlay">
                  <div className="loading-container bg-white p-4 rounded shadow-lg">
                    <h4 className="text-center mb-4">
                      <i className="fas fa-signature text-primary me-2 fa-bounce"></i>
                      Sedang Memproses Dokumen
                    </h4>
                    
                    <div className="loading-steps">
                      {loadingSteps.map((step, index) => (
                        <div 
                          key={index} 
                          className={`loading-step d-flex align-items-center mb-3 ${step.active ? 'active' : ''} ${step.completed ? 'completed' : ''}`}
                        >
                          <div className={`step-indicator ${step.active ? 'active' : ''} ${step.completed ? 'completed' : ''}`}>
                            {step.completed ? (
                              <i className="fas fa-check-circle text-success"></i>
                            ) : step.active ? (
                              <Spinner animation="border" size="sm" className="text-primary" />
                            ) : (
                              index + 1
                            )}
                </div>
                          <div className="step-text ms-3">
                            {step.text}
                            {step.active && !step.completed && (
                              <span className="ms-2 text-primary">
                                <Spinner animation="grow" size="sm" className="me-1" />
                                Sedang diproses...
                              </span>
                            )}
                            {step.completed && (
                              <span className="ms-2 text-success">
                                <i className="fas fa-check-circle me-1"></i>
                                Selesai
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    <div className="mt-4">
                      <ProgressBar 
                        animated 
                        now={((currentStep + 1) / loadingSteps.length) * 100} 
                        variant="primary" 
                        className="mb-3"
                      />
                      <p className="text-center small">
                        {currentStep < loadingSteps.length ? (
                          <>
                            <i className="fas fa-spinner fa-spin me-2"></i>
                            <strong>Langkah {currentStep + 1} dari {loadingSteps.length}:</strong> {loadingSteps[currentStep].text}
                          </>
                        ) : (
                          <>
                            <i className="fas fa-check-circle text-success me-2"></i>
                            Menyelesaikan proses...
                          </>
                        )}
                      </p>
                      <div className="text-center mt-3">
                        <p className="text-muted small">Mohon tunggu, jangan tutup halaman ini</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <Alert variant="danger" className="mt-3 shadow-sm" dismissible onClose={() => setError('')}>
                  <div className="d-flex align-items-center">
                    <div className="p-2 rounded-circle bg-danger bg-opacity-10 me-3">
                      <i className="fas fa-exclamation-circle text-danger"></i>
                    </div>
                    <div>{error}</div>
                  </div>
                </Alert>
              )}

              {!isConnected ? (
                <div className="d-flex align-items-center justify-content-center min-vh-100">
                  <Card className="text-center p-5 shadow-sm glass-card" style={{ maxWidth: '500px' }}>
                    <Card.Body>
                      <div className="file-icon-container mx-auto">
                        <i className="fas fa-wallet fa-2x text-primary"></i>
                      </div>
                      <h3 className="mb-3">Hubungkan MetaMask</h3>
                      <p className="text-muted mb-4">
                        Silakan hubungkan wallet MetaMask Anda untuk mulai menggunakan aplikasi
                      </p>
                      <Button 
                        variant="primary" 
                        size="lg"
                        onClick={connectWallet}
                        className="px-4 py-2"
                      >
                        <i className="fas fa-wallet me-2"></i>
                        Hubungkan MetaMask
                      </Button>
                    </Card.Body>
                  </Card>
                </div>
              ) : (
                <div className="mb-4">
                  <div className="app-header text-center mb-5">
                    <h2 className="fw-bold">Digital Signature Blockchain</h2>
                    <p className="text-muted">Tanda tangani dokumen Anda dengan aman menggunakan blockchain</p>
                  </div>
                  
                  <div className="tab-navigation">
                    <Nav className="nav-tabs-custom justify-content-center mb-4" variant="pills">
                      <Nav.Item>
                        <Nav.Link 
                          className={`nav-link-custom ${activeTab === 'sign' ? 'active' : ''}`}
                          onClick={() => setActiveTab('sign')}
                        >
                          <i className="fas fa-signature me-2"></i>
                          Tandatangani
                        </Nav.Link>
                      </Nav.Item>
                      <Nav.Item>
                        <Nav.Link 
                          className={`nav-link-custom ${activeTab === 'verify' ? 'active' : ''}`}
                          onClick={() => setActiveTab('verify')}
                        >
                          <i className="fas fa-check-circle me-2"></i>
                          Verifikasi
                        </Nav.Link>
                      </Nav.Item>
                      <Nav.Item>
                        <Nav.Link 
                          className={`nav-link-custom ${activeTab === 'history' ? 'active' : ''}`}
                          onClick={() => {
                            setActiveTab('history');
                            viewSignedDocuments();
                          }}
                        >
                          <i className="fas fa-history me-2"></i>
                          Riwayat
                        </Nav.Link>
                      </Nav.Item>
                    </Nav>
                  </div>

                  <Tabs defaultActiveKey="sign" className="mb-4"
                    activeKey={activeTab}
                    onSelect={(k) => {
                      setActiveTab(k);
                      if (k === 'history' && isConnected) {
                        // Auto refresh saat beralih ke tab riwayat
                        viewSignedDocuments();
                      }
                    }}
                  >
                  <Tab eventKey="sign" title="Tandatangani Dokumen">
                    <div className="container-fluid px-lg-4">
                      <Row className="g-4 h-100">
                        <Col lg={5}>
                          <Card className="shadow-sm document-card h-100">
                            <Card.Header className="d-flex align-items-center">
                              <div className="file-icon pdf me-3">
                                <i className="fas fa-file-pdf"></i>
                              </div>
                              <h5 className="mb-0">Upload Dokumen</h5>
                            </Card.Header>
                            <Card.Body className="p-4">
                              {!file ? (
                                <div className="upload-area" onClick={() => document.querySelector('input[type="file"]').click()}>
                                  <i className="fas fa-cloud-upload-alt upload-icon"></i>
                                  <h5>Klik untuk Upload Dokumen</h5>
                                  <p className="text-muted mb-4">Atau drag and drop file Anda di sini</p>
                                  <div className="d-flex justify-content-center">
                                    <div className="custom-file-button d-inline-block">
                                      <Form.Control 
                                        type="file" 
                                        onChange={handleFileChange}
                                        className="custom-file-input"
                                        hidden
                                      />
                                      <Button variant="outline-primary" className="px-4">
                                        <i className="fas fa-file me-2"></i>
                                        Pilih File
                                      </Button>
                                    </div>
                                  </div>
                                  <div className="mt-3">
                                    <small className="text-muted">Format file yang didukung: PDF</small>
                                  </div>
                                </div>
                              ) : (
                                <div>
                                  <div className="signature-stepper mb-4">
                                    <div className="stepper-container">
                                      <div className={`stepper-step ${hash ? 'completed' : !hash && !signature ? 'active' : ''}`}>
                                        <div className="step-number">
                                          {hash ? <i className="fas fa-check"></i> : '1'}
                                        </div>
                                        <div className="step-label">Generate Hash</div>
                                        <div className="step-line"></div>
                                      </div>
                                      <div className={`stepper-step ${signature ? 'completed' : hash && !signature ? 'active' : ''}`}>
                                        <div className="step-number">
                                          {signature ? <i className="fas fa-check"></i> : '2'}
                                        </div>
                                        <div className="step-label">Tanda Tangani</div>
                                        <div className="step-line"></div>
                                      </div>
                                      <div className={`stepper-step ${txHash ? 'completed' : signature && !txHash ? 'active' : ''}`}>
                                        <div className="step-number">
                                          {txHash ? <i className="fas fa-check"></i> : '3'}
                                        </div>
                                        <div className="step-label">Unduh Dokumen</div>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  <div className="file-details mb-4">
                                    <div className="d-flex align-items-center mb-4">
                                      <div className={`file-icon ${file.type.includes('pdf') ? 'pdf' : 'txt'} me-3`}>
                                        <i className={`fas fa-file-${file.type.includes('pdf') ? 'pdf' : 'alt'}`}></i>
                                      </div>
                                      <div>
                                        <h5 className="mb-1">{file.name}</h5>
                                        <p className="text-muted mb-0">
                                          {file.type} • {(file.size / 1024).toFixed(2)} KB
                                        </p>
                                      </div>
                                      <Button 
                                        variant="link" 
                                        className="ms-auto text-danger"
                                        onClick={() => setFile(null)}
                                      >
                                        <i className="fas fa-times-circle"></i>
                                      </Button>
                                    </div>
                                    
                                    <div className="action-buttons d-grid gap-2">
                                      {!hash && (
                                        <Button 
                                          variant="primary" 
                                          onClick={generateHash}
                                          disabled={!file || loading}
                                          className="btn-with-icon step-button"
                                          size="lg"
                                        >
                                          <span className="step-btn-number">1</span>
                                          <i className="fas fa-hashtag me-2"></i>
                                          Generate Hash
                                        </Button>
                                      )}
                                      
                                      {hash && !signature && (
                                        <Button 
                                          variant="success" 
                                          onClick={signDocument}
                                          disabled={loading}
                                          className="btn-with-icon step-button"
                                          size="lg"
                                        >
                                          <span className="step-btn-number">2</span>
                                          <i className="fas fa-signature me-2"></i>
                                          Tandatangani Dokumen
                                        </Button>
                                      )}
                                      
                                      {signature && txHash && (
                                        <Button 
                                          variant="info"
                                          onClick={downloadSignedDocument}
                                          disabled={!file || !qrCodeData || loading}
                                          className="btn-with-icon step-button"
                                          size="lg"
                                        >
                                          <span className="step-btn-number">3</span>
                                          <i className="fas fa-download me-2"></i>
                                          Unduh Dokumen Bertanda Tangan
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                  
                                  {hash && (
                                    <div className="signature-section mb-4">
                                      <h6 className="d-flex align-items-center mb-3">
                                        <i className="fas fa-hashtag me-2 text-primary"></i>
                                        Hash Dokumen
                                      </h6>
                                      <div className="hash-container">
                                        <code className="d-block small">{hash}</code>
                                        <button 
                                          className="copy-button"
                                          onClick={() => {
                                            navigator.clipboard.writeText(hash);
                                            showSuccessModal('Hash Disalin', 'Hash dokumen berhasil disalin ke clipboard!');
                                          }}
                                        >
                                          <i className="fas fa-copy"></i>
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                  
                                  {signature && (
                                    <div className="signature-section mb-4">
                                      <h6 className="d-flex align-items-center mb-3">
                                        <i className="fas fa-signature me-2 text-success"></i>
                                        Tanda Tangan Digital
                                      </h6>
                                      <div className="hash-container">
                                        <code className="d-block small">{signature.substring(0, 60)}...</code>
                                        <button 
                                          className="copy-button"
                                          onClick={() => {
                                            navigator.clipboard.writeText(signature);
                                            showSuccessModal('Tanda Tangan Disalin', 'Tanda tangan digital berhasil disalin ke clipboard!');
                                          }}
                                        >
                                          <i className="fas fa-copy"></i>
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                  
                                  {txHash && (
                                    <div className="signature-section">
                                      <div className="d-flex align-items-center justify-content-between mb-3">
                                        <h6 className="d-flex align-items-center mb-0">
                                          <i className="fas fa-exchange-alt me-2 text-warning"></i>
                                          Transaction Hash
                                        </h6>
                                        <span className="status-badge verified">
                                          <i className="fas fa-check-circle"></i>
                                          Terverifikasi
                                        </span>
                                      </div>
                                      <div className="hash-container">
                                        <code className="d-block small">{txHash.substring(0, 60)}...</code>
                                        <button 
                                          className="copy-button"
                                          onClick={() => {
                                            navigator.clipboard.writeText(txHash);
                                            showSuccessModal('Transaction Hash Disalin', 'Transaction hash berhasil disalin ke clipboard!');
                                          }}
                                        >
                                          <i className="fas fa-copy"></i>
                                        </button>
                                      </div>
                                      <div className="mt-3 text-end">
                                        <Button 
                                          variant="outline-warning" 
                                          size="sm"
                                          href={`https://sepolia.etherscan.io/tx/${txHash}`}
                                          target="_blank"
                                        >
                                          <i className="fas fa-external-link-alt me-2"></i>
                                          Lihat di Etherscan
                                        </Button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </Card.Body>
                          </Card>
                        </Col>

                            <Col lg={7}>
                              <Card className="shadow-sm document-card h-100 d-flex flex-column">
                                <Card.Header className="d-flex align-items-center">
                                  <div className="file-icon me-3">
                                    <i className="fas fa-file-alt"></i>
                                  </div>
                                  <h5 className="mb-0">Preview Dokumen</h5>
                                </Card.Header>
                                <Card.Body className="p-0 flex-grow-1">
                              {file ? (
                                  <div 
                                    ref={documentRef}
                                    className="document-preview"
                                    style={{ 
                                      position: 'relative',
                                      minHeight: '700px',
                                      height: 'calc(100vh - 300px)',
                                      overflow: 'auto',
                                      background: 'white',
                                      border: '1px solid rgba(0,0,0,0.05)',
                                      borderRadius: 'var(--border-radius)'
                                    }}
                                  >
                                    <iframe 
                                      src={URL.createObjectURL(file)} 
                                      type={file.type}
                                      style={{ width: '100%', height: '100%', minHeight: '700px', border: 'none' }}
                                      title="Document Preview"
                                    />
                                    {(!!hash && !!signature && !!qrCodeData) && (
                                      <div 
                                        style={{
                                          position: 'absolute',
                                          right: 0,
                                          bottom: 0,
                                          margin: 16,
                                          zIndex: 10,
                                          backgroundColor: 'white',
                                            padding: 8,
                                            borderRadius: 8,
                                            boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
                                        }}
                                      >
                                        <QRCodeSVG 
                                          value={qrCodeData}
                                          size={90}
                                          level="H"
                                          includeMargin={false}
                                        />
                                          <div className="text-center mt-2">
                                            <small className="text-muted">QR Verifikasi</small>
                                          </div>
                                      </div>
                                    )}
                                  </div>
                                  ) : (
                                    <div className="empty-state">
                                      <i className="fas fa-file-alt empty-state-icon"></i>
                                      <h5>Tidak Ada Dokumen</h5>
                                      <p className="text-muted">Upload dokumen terlebih dahulu untuk melihat preview</p>
                                    </div>
                                  )}
                                </Card.Body>
                              </Card>
                            </Col>
                          </Row>

                                    {signature && txHash && (
                          <div className="mt-4">
                            <Card className="shadow-sm glass-card">
                              <Card.Body className="p-4">
                                <div className="d-flex align-items-center">
                                  <div className="p-3 rounded-circle bg-success bg-opacity-10 me-3">
                                    <i className="fas fa-check-circle text-success fa-2x"></i>
                                  </div>
                                  <div>
                                    <h4 className="mb-1">Dokumen Berhasil Ditandatangani!</h4>
                                    <p className="mb-0 text-muted">Dokumen Anda telah berhasil ditandatangani dan disimpan dalam blockchain</p>
                                  </div>
                                      <Button 
                                        variant="success"
                                    className="ms-auto"
                                        onClick={downloadSignedDocument}
                                        disabled={!file || !qrCodeData || loading}
                                      >
                                        <i className="fas fa-download me-2"></i>
                                    Unduh Dokumen
                                      </Button>
                                    </div>
                          </Card.Body>
                        </Card>
                          </div>
                        )}
                      </div>
                  </Tab>

                  <Tab eventKey="verify" title="Verifikasi Dokumen">
                    <Card className="shadow-sm">
                      <Card.Header className="bg-info text-white">
                        <h4 className="mb-0">
                          <i className="fas fa-check-circle me-2"></i>
                          Verifikasi Dokumen yang Sudah Ditandatangani
                        </h4>
                      </Card.Header>
                      <Card.Body>
                        <Row className="g-3">
                          <Col md={6}>
                            <Form>
                              <Form.Group className="mb-4">
                                <Form.Label>
                                  <i className="fas fa-file me-2"></i>
                                  Upload File Dokumen yang Sudah Ditandatangani
                                </Form.Label>
                                <Form.Control
                                  type="file"
                                    onChange={(e) => {
                                    const selectedFile = e.target.files[0];
                                      if (selectedFile) {
                                        verifyDocument(selectedFile);
                                      }
                                  }}
                                />
                              </Form.Group>
                            </Form>
                          </Col>
                          <Col md={6}>
                            <div className="text-center">
                              <div className="mb-3">
                                <h6>Atau</h6>
                              </div>
                              <Button 
                                variant="outline-primary" 
                                size="lg"
                                onClick={() => setShowScanner(true)}
                                className="w-100"
                              >
                                <i className="fas fa-qrcode me-2"></i>
                                Scan QR Code
                              </Button>
                              <p className="text-muted mt-2 small">
                                Scan QR code pada dokumen yang sudah ditandatangani
                              </p>
                            </div>
                          </Col>
                        </Row>
                        
                        {verifyLoading && (
                          <div className="text-center my-3">
                            <Spinner animation="border" variant="primary" />
                            <div>Memverifikasi dokumen...</div>
                          </div>
                        )}
                        
                        {verifyResult && (
                          <Card className="mt-4">
                            <Card.Header className={verifyResult.isValid ? 'bg-success text-white' : 'bg-danger text-white'}>
                              <h5 className="mb-0">
                                <i className={`fas fa-${verifyResult.isValid ? 'check' : 'times'}-circle me-2`}></i>
                                Hasil Verifikasi
                              </h5>
                            </Card.Header>
                            <Card.Body>
                              <Alert variant={verifyResult.isValid ? 'success' : 'danger'}>
                                {verifyResult.message}
                              </Alert>
                              <ListGroup variant="flush">
                                <ListGroup.Item>
                                  <i className="fas fa-hashtag me-2"></i>
                                  Hash: <code className="d-block mt-1">{verifyResult.details.hash}</code>
                                </ListGroup.Item>
                                {verifyResult.details.signature && (
                                  <ListGroup.Item>
                                    <i className="fas fa-signature me-2"></i>
                                    Signature: <code className="d-block mt-1">{verifyResult.details.signature}</code>
                                  </ListGroup.Item>
                                )}
                                  {verifyResult.details.signer && (
                                    <ListGroup.Item>
                                      <i className="fas fa-user-edit me-2"></i>
                                      Penanda Tangan: 
                                      <div className="d-flex align-items-center justify-content-between mt-1">
                                        <code className="me-2" style={{wordBreak: 'break-all', flex: '1'}}>{verifyResult.details.signer}</code>
                                        <Button 
                                          variant="outline-primary" 
                                          size="sm"
                                          href={`https://sepolia.etherscan.io/address/${verifyResult.details.signer}`}
                                          target="_blank"
                                        >
                                          <i className="fas fa-external-link-alt me-1"></i>
                                          Etherscan
                                        </Button>
                                      </div>
                                    </ListGroup.Item>
                                  )}
                                {verifyResult.details.transactionHash && (
                                  <ListGroup.Item>
                                    <i className="fas fa-exchange-alt me-2"></i>
                                    Transaction Hash: <code className="d-block mt-1">{verifyResult.details.transactionHash}</code>
                                  </ListGroup.Item>
                                )}
                                {verifyResult.details.blockNumber && (
                                  <ListGroup.Item>
                                    <i className="fas fa-cube me-2"></i>
                                    Block Number: {verifyResult.details.blockNumber}
                                  </ListGroup.Item>
                                )}
                                {verifyResult.details.timestamp && (
                                  <ListGroup.Item>
                                    <i className="fas fa-clock me-2"></i>
                                    Waktu: {verifyResult.details.timestamp}
                                  </ListGroup.Item>
                                )}
                              </ListGroup>
                              {verifyResult.details.transactionHash && (
                                <div className="mt-3">
                                  <Button
                                    variant="outline-primary"
                                    href={`https://sepolia.etherscan.io/tx/${verifyResult.details.transactionHash}#eventlog`}
                                    target="_blank"
                                    className="w-100"
                                  >
                                    <i className="fas fa-external-link-alt me-2"></i>
                                    Lihat di Etherscan
                                  </Button>
                                </div>
                              )}
                            </Card.Body>
                          </Card>
                        )}
                      </Card.Body>
                    </Card>
                  </Tab>

                  <Tab eventKey="history" title="Riwayat Dokumen">
                    <Card className="shadow-sm">
                      <Card.Header className="bg-secondary text-white d-flex justify-content-between align-items-center">
                        <h4 className="mb-0">
                          <i className="fas fa-history me-2"></i>
                          Riwayat Dokumen yang Ditandatangani
                        </h4>
                        <Badge bg="light" text="dark" className="px-3 py-2">
                          <i className="fas fa-wallet me-2"></i>
                          {account.slice(0, 6)}...{account.slice(-4)}
                        </Badge>
                      </Card.Header>
                      <Card.Body>
                        {loading ? (
                          <div className="text-center py-5">
                            <Spinner animation="border" variant="primary" />
                            <p className="mt-2">Mengambil riwayat dokumen...</p>
                          </div>
                        ) : (
                          <Row>
                            <Col lg={6}>
                              <div className="documents-list">
                                {documentHistory.length > 0 ? (
                                  documentHistory.map((doc, index) => (
                                    <Card 
                                      key={index} 
                                      className="mb-3 cursor-pointer"
                                      onClick={() => setSelectedDocument(doc)}
                                      style={{
                                        cursor: 'pointer',
                                        border: selectedDocument?.hash === doc.hash ? '2px solid #0d6efd' : '1px solid #dee2e6'
                                      }}
                                    >
                                      <Card.Body>
                                        <div className="d-flex justify-content-between align-items-center mb-2">
                                          <h6 className="mb-0">
                                            <i className="fas fa-file-signature me-2"></i>
                                              Dokumen #{index + 1}
                                          </h6>
                                          <Badge bg={selectedDocument?.hash === doc.hash ? 'primary' : 'secondary'}>
                                            {new Date(doc.timestamp).toLocaleDateString()}
                                          </Badge>
                                        </div>
                                        <ListGroup variant="flush">
                                          <ListGroup.Item className="px-0">
                                            <small className="text-muted">Hash:</small>
                                            <code className="d-block small">{doc.hash.slice(0, 20)}...</code>
                                          </ListGroup.Item>
                                        </ListGroup>
                                      </Card.Body>
                                    </Card>
                                  ))
                                ) : (
                                  <Alert variant="info">
                                    <i className="fas fa-info-circle me-2"></i>
                                    Belum ada dokumen yang ditandatangani dengan wallet ini
                                  </Alert>
                                )}
                              </div>
                            </Col>
                            
                            <Col lg={6}>
                              {selectedDocument ? (
                                <Card className="h-100">
                                  <Card.Header className="bg-primary text-white">
                                    <h5 className="mb-0">
                                      <i className="fas fa-file-alt me-2"></i>
                                      Detail Dokumen
                                    </h5>
                                  </Card.Header>
                                  <Card.Body>
                                    <div className="mb-4">
                                      <h6 className="mb-3">Informasi Dokumen:</h6>
                                      <ListGroup variant="flush">
                                        <ListGroup.Item>
                                          <small className="text-muted d-block mb-1">Hash Dokumen:</small>
                                          <code className="d-block small bg-light p-2 rounded">{selectedDocument.hash}</code>
                                        </ListGroup.Item>
                                        <ListGroup.Item>
                                          <small className="text-muted d-block mb-1">Transaction Hash:</small>
                                          <code className="d-block small bg-light p-2 rounded">
                                            {getCorrectTxHash(selectedDocument.hash, selectedDocument.transactionHash)}
                                          </code>
                                        </ListGroup.Item>
                                        <ListGroup.Item>
                                          <small className="text-muted d-block mb-1">Penandatangan:</small>
                                          <code className="d-block small bg-light p-2 rounded">{selectedDocument.signer}</code>
                                        </ListGroup.Item>
                                        <ListGroup.Item className="d-flex justify-content-between align-items-center">
                                          <div>
                                            <small className="text-muted d-block">Block Number:</small>
                                            <strong>{selectedDocument.blockNumber}</strong>
                                          </div>
                                          <div className="text-end">
                                            <small className="text-muted d-block">Waktu Tanda Tangan:</small>
                                            <strong>{selectedDocument.timestamp}</strong>
                                          </div>
                                        </ListGroup.Item>
                                      </ListGroup>
                                    </div>

                                    {/* Tambahkan preview PDF */}
                                    {documentFiles.has(selectedDocument.hash) && (
                                      <div className="mb-4">
                                        <h6 className="mb-3">Preview Dokumen:</h6>
                                        <div className="document-preview" style={{ height: '500px', border: '1px solid #dee2e6', borderRadius: '0.5rem', overflow: 'hidden' }}>
                                          <iframe 
                                            src={URL.createObjectURL(documentFiles.get(selectedDocument.hash))}
                                            type="application/pdf"
                                            style={{ width: '100%', height: '100%', border: 'none' }}
                                            title="Document History Preview"
                                          />
                                        </div>
                                      </div>
                                    )}

                                    <div className="d-grid gap-2">
                                      <Button 
                                        variant="outline-primary"
                                        href={`https://sepolia.etherscan.io/tx/${getCorrectTxHash(selectedDocument.hash, selectedDocument.transactionHash)}#eventlog`}
                                        target="_blank"
                                      >
                                        <i className="fas fa-external-link-alt me-2"></i>
                                        Lihat di Etherscan
                                      </Button>
                                    </div>
                                  </Card.Body>
                                </Card>
                              ) : (
                                <div className="text-center text-muted py-5">
                                  <i className="fas fa-file-alt fa-3x mb-3"></i>
                                  <h5>Pilih Dokumen</h5>
                                  <p className="small">Klik pada dokumen di sebelah kiri untuk melihat detail</p>
                                </div>
                              )}
                            </Col>
                          </Row>
                        )}
                      </Card.Body>
                    </Card>
                  </Tab>
                </Tabs>
                </div>
              )}
            </Container>

            <Modal show={showModal} onHide={() => setShowModal(false)} centered>
              <Modal.Header closeButton>
                <Modal.Title>
                  <i className="fas fa-check-circle text-success me-2"></i>
                  {modalContent.title}
                </Modal.Title>
              </Modal.Header>
              <Modal.Body>
                <p className="mb-0">{modalContent.body}</p>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="secondary" onClick={() => setShowModal(false)}>
                  <i className="fas fa-times me-2"></i>
                  Tutup
                </Button>
              </Modal.Footer>
            </Modal>

            <Modal
              show={showScanner}
              onHide={() => setShowScanner(false)}
              centered
              size="lg"
            >
              <Modal.Header closeButton>
                <Modal.Title>
                  <i className="fas fa-camera me-2"></i>
                  Scan QR Code
                </Modal.Title>
              </Modal.Header>
              <Modal.Body>
                <div style={{ width: '100%', maxWidth: '500px', margin: '0 auto' }}>
                  <Scanner
                    onScan={handleScan}
                    constraints={{ facingMode: 'environment' }}
                    styles={{ container: { width: '100%' } }}
                  />
                </div>
                <div className="text-center mt-3">
                  <p className="text-muted">
                    Arahkan kamera ke QR Code pada dokumen yang ingin diverifikasi
                  </p>
                </div>
              </Modal.Body>
            </Modal>
          </div>
        } />
      </Routes>
    </Router>
  );
}

export default App; 

// Tambahan CSS untuk tampilan loading
const styles = `
  .loading-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.7);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 9999;
    backdrop-filter: blur(5px);
  }
  
  .loading-container {
    width: 100%;
    max-width: 550px;
    animation: fadeIn 0.3s ease;
  }
  
  .loading-step {
    transition: all 0.3s ease;
    padding: 10px;
    border-radius: 8px;
  }
  
  .loading-step.active {
    background-color: rgba(13, 110, 253, 0.1);
  }
  
  .loading-step.completed {
    background-color: rgba(25, 135, 84, 0.1);
  }
  
  .step-indicator {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background-color: #e9ecef;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    transition: all 0.3s ease;
  }
  
  .step-indicator.active {
    background-color: #0d6efd;
    color: white;
  }
  
  .step-indicator.completed {
    background-color: #198754;
    color: white;
  }
  
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(-20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  
  .fa-bounce {
    animation: bounce 1s infinite;
  }
  
  @keyframes bounce {
    0%, 20%, 50%, 80%, 100% {transform: translateY(0);}
    40% {transform: translateY(-10px);}
    60% {transform: translateY(-5px);}
  }
`;

// Inject CSS
const styleElement = document.createElement('style');
styleElement.textContent = styles;
document.head.appendChild(styleElement); 