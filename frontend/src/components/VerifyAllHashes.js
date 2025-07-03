import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import DigitalSignature from '../contracts/DigitalSignature.json';
import { PDFDocument } from 'pdf-lib';
import { 
  Card, Button, Spinner, Alert, ListGroup 
} from 'react-bootstrap';

// Alamat kontrak
const CONTRACT_ADDRESS = "0xf07A6d2bfBc038AECCfe76cA4Fb4dca891e3A383";

/**
 * Komponen untuk memverifikasi dokumen dengan mencari di seluruh hash yang terdaftar
 */
const VerifyAllHashes = ({ file, isConnected, account }) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [allHashes, setAllHashes] = useState([]);
  
  // Load semua hash yang terdaftar saat komponen mount
  useEffect(() => {
    const loadAllHashes = async () => {
      if (!isConnected) return;
      
      try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const contract = new ethers.Contract(CONTRACT_ADDRESS, DigitalSignature.abi, provider);
        
        // Ambil semua event DocumentSigned
        const filter = contract.filters.DocumentSigned();
        const events = await contract.queryFilter(filter);
        
        // Kumpulkan informasi hash
        const hashesInfo = {};
        for (const event of events) {
          const hash = event.args.documentHash;
          const signer = event.args.signer;
          const timestamp = event.args.timestamp.toString();
          const txHash = event.transactionHash;
          
          hashesInfo[hash] = {
            signer,
            timestamp: new Date(parseInt(timestamp) * 1000).toLocaleString(),
            txHash,
            blockNumber: event.blockNumber
          };
        }
        
        setAllHashes(hashesInfo);
        console.log(`Loaded ${Object.keys(hashesInfo).length} registered hashes`);
      } catch (err) {
        console.error('Error loading registered hashes:', err);
      }
    };
    
    loadAllHashes();
  }, [isConnected]);

  // Fungsi untuk mengekstrak hash dari QR code
  const extractHashFromQR = async (pdfDoc) => {
    try {
      // Ekstrak teks dari PDF
      const pdfText = await pdfDoc.saveAsBase64({dataUri: true});
      
      // Pola yang mungkin mengandung hash
      const patterns = [
        { name: 'Certificate URL', regex: /\/certificate\/([a-fA-F0-9]{64})/ },
        { name: 'Hash URL param', regex: /hash=([a-fA-F0-9]{64})/ },
        { name: 'Raw Hex', regex: /([a-fA-F0-9]{64})/ }
      ];
      
      for (const pattern of patterns) {
        const matches = pdfText.match(pattern.regex);
        if (matches && matches[1]) {
          return { 
            type: pattern.name, 
            hash: `0x${matches[1]}`, 
            rawMatch: matches[1] 
          };
        }
      }
      
      return null;
    } catch (err) {
      console.error('Error extracting hash from QR:', err);
      return null;
    }
  };
  
  // Fungsi utama verifikasi
  const verifyDocument = async () => {
    if (!file || !isConnected) return;
    
    setLoading(true);
    setError('');
    setResult(null);
    
    try {
      // 1. Baca file sebagai ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();
      
      // 2. Hitung hash langsung dari file PDF
      const fileHash = ethers.utils.keccak256(new Uint8Array(arrayBuffer));
      console.log('Dokumen hash dari file:', fileHash);
      
      // 3. Cek apakah hash file langsung terdaftar
      const fileHashRegistered = allHashes[fileHash];
      
      // 4. Coba ekstrak hash dari QR code
      let qrHash = null;
      let pdfDoc = null;
      
      try {
        pdfDoc = await PDFDocument.load(arrayBuffer);
        const extractedHash = await extractHashFromQR(pdfDoc);
        
        if (extractedHash) {
          qrHash = extractedHash.hash;
          console.log(`Hash dari QR code (${extractedHash.type}):`, qrHash);
        }
      } catch (pdfErr) {
        console.error('Error loading PDF:', pdfErr);
      }
      
      // 5. Cek apakah hash dari QR terdaftar
      const qrHashRegistered = qrHash ? allHashes[qrHash] : null;
      
      // 6. Tentukan hasil verifikasi
      if (fileHashRegistered || qrHashRegistered) {
        // Dokumen valid! Gunakan info dari hash yang terdaftar
        const hashInfo = qrHashRegistered || fileHashRegistered;
        const matchedHash = qrHashRegistered ? qrHash : fileHash;
        
        setResult({
          isValid: true,
          message: 'Dokumen valid dan terdaftar di blockchain!',
          matchType: qrHashRegistered ? 'QR Code Hash' : 'File Hash',
          details: {
            hash: matchedHash,
            signer: hashInfo.signer,
            timestamp: hashInfo.timestamp,
            transactionHash: hashInfo.txHash,
            blockNumber: hashInfo.blockNumber
          }
        });
      } else {
        // Dokumen tidak valid atau tidak terdaftar
        setResult({
          isValid: false,
          message: 'Dokumen tidak ditemukan di blockchain',
          details: {
            fileHash: fileHash,
            qrHash: qrHash || 'Tidak ditemukan'
          }
        });
      }
    } catch (err) {
      console.error('Error verifying document:', err);
      setError(`Error saat verifikasi: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="verify-all-hashes">
      <Card className="shadow-sm mb-4">
        <Card.Header className="bg-primary text-white">
          <h5 className="mb-0">
            <i className="fas fa-shield-alt me-2"></i>
            Verifikasi Dokumen Smart
          </h5>
        </Card.Header>
        <Card.Body>
          <p className="text-muted mb-3">
            Mode verifikasi ini memeriksa dokumen Anda terhadap semua hash yang terdaftar di blockchain,
            termasuk mengekstrak QR code dan metadata.
          </p>
          
          {error && (
            <Alert variant="danger" className="mb-3">
              <i className="fas fa-exclamation-circle me-2"></i>
              {error}
            </Alert>
          )}
          
          {file ? (
            <>
              <div className="d-flex justify-content-between align-items-center mb-3 p-3 bg-light rounded">
                <div>
                  <strong><i className="fas fa-file-pdf me-2 text-danger"></i>{file.name}</strong>
                  <div className="text-muted small">{(file.size / 1024).toFixed(2)} KB</div>
                </div>
                <Button 
                  variant="primary" 
                  onClick={verifyDocument}
                  disabled={loading || !isConnected || Object.keys(allHashes).length === 0}
                >
                  {loading ? (
                    <>
                      <Spinner animation="border" size="sm" className="me-2" />
                      Memverifikasi...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-check-circle me-2"></i>
                      Verifikasi Dokumen
                    </>
                  )}
                </Button>
              </div>
              
              {Object.keys(allHashes).length === 0 && isConnected && (
                <Alert variant="warning">
                  <i className="fas fa-exclamation-triangle me-2"></i>
                  Tidak ada hash terdaftar di blockchain. Perlu menandatangani dokumen terlebih dahulu.
                </Alert>
              )}
              
              {result && (
                <Card className={`border-${result.isValid ? 'success' : 'danger'} mt-4`}>
                  <Card.Header className={`bg-${result.isValid ? 'success' : 'danger'} text-white`}>
                    <h5 className="mb-0">
                      <i className={`fas fa-${result.isValid ? 'check' : 'times'}-circle me-2`}></i>
                      Hasil Verifikasi
                    </h5>
                  </Card.Header>
                  <Card.Body>
                    <Alert variant={result.isValid ? 'success' : 'danger'}>
                      {result.message}
                      {result.isValid && result.matchType && (
                        <div className="mt-1 small">
                          Terverifikasi melalui: <strong>{result.matchType}</strong>
                        </div>
                      )}
                    </Alert>
                    
                    <ListGroup variant="flush">
                      {result.isValid ? (
                        <>
                          <ListGroup.Item>
                            <i className="fas fa-hashtag me-2"></i>
                            Hash: <code className="d-block mt-1">{result.details.hash}</code>
                          </ListGroup.Item>
                          <ListGroup.Item>
                            <i className="fas fa-user me-2"></i>
                            Penandatangan: <code className="d-block mt-1">{result.details.signer}</code>
                          </ListGroup.Item>
                          <ListGroup.Item>
                            <i className="fas fa-clock me-2"></i>
                            Waktu: {result.details.timestamp}
                          </ListGroup.Item>
                          <ListGroup.Item>
                            <i className="fas fa-exchange-alt me-2"></i>
                            Transaction Hash: <code className="d-block mt-1">{result.details.transactionHash}</code>
                          </ListGroup.Item>
                        </>
                      ) : (
                        <>
                          <ListGroup.Item>
                            <i className="fas fa-hashtag me-2"></i>
                            Hash File: <code className="d-block mt-1">{result.details.fileHash}</code>
                          </ListGroup.Item>
                          <ListGroup.Item>
                            <i className="fas fa-qrcode me-2"></i>
                            Hash QR Code: <code className="d-block mt-1">{result.details.qrHash}</code>
                          </ListGroup.Item>
                        </>
                      )}
                    </ListGroup>
                    
                    {result.isValid && (
                      <div className="mt-3">
                        <Button
                          variant="outline-primary"
                          href={`https://sepolia.etherscan.io/tx/${result.details.transactionHash}#eventlog`}
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
            </>
          ) : (
            <div className="text-center py-5">
              <i className="fas fa-upload fa-3x text-muted mb-3"></i>
              <h5>Pilih dokumen untuk verifikasi terlebih dahulu</h5>
              <p className="text-muted small">Dokumen akan diperiksa terhadap semua hash terdaftar</p>
            </div>
          )}
        </Card.Body>
      </Card>
    </div>
  );
};

export default VerifyAllHashes; 