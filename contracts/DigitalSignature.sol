// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract DigitalSignature {
    struct Signature {
        bytes32 documentHash;
        bytes signature;
        address signer;
        uint256 timestamp;
    }

    mapping(bytes32 => Signature) public signatures;
    event DocumentSigned(bytes32 indexed documentHash, address indexed signer, uint256 timestamp);

    function storeSignature(bytes32 _documentHash, bytes memory _signature) public {
        require(signatures[_documentHash].signer == address(0), "Document already signed");
        
        signatures[_documentHash] = Signature({
            documentHash: _documentHash,
            signature: _signature,
            signer: msg.sender,
            timestamp: block.timestamp
        });

        emit DocumentSigned(_documentHash, msg.sender, block.timestamp);
    }

    function verifySignature(
        address _signer,
        bytes32 _documentHash,
        bytes memory _signature
    ) public view returns (bool) {
        Signature memory sig = signatures[_documentHash];
        return (
            sig.signer == _signer &&
            sig.documentHash == _documentHash &&
            keccak256(sig.signature) == keccak256(_signature)
        );
    }

    function getSignature(bytes32 _documentHash) public view returns (
        bytes32 documentHash,
        bytes memory signature,
        address signer,
        uint256 timestamp
    ) {
        Signature memory sig = signatures[_documentHash];
        return (sig.documentHash, sig.signature, sig.signer, sig.timestamp);
    }
} 