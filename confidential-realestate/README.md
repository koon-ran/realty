# Covert Realty Tokenization

A privacy-preserving real estate tokenization platform built with **Zama FHEVM** (Fully Homomorphic Encryption). This MVP demonstrates encrypted share ownership where only the shareholder and property owner can view holdings, while keeping prices and rent amounts public.

## Privacy Features

- **Encrypted Share Holdings**: Share ownership stored as `euint64` (encrypted integers)
- **Access Control Lists (ACL)**: Only shareholder + property owner can decrypt holdings
- **Selective Privacy**: Prices, rent amounts, and total shares remain public for transparency
- **On-chain Confidentiality**: All encryption happens on-chain via FHEVM

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ List Property│  │ Buy Shares   │  │ View Holdings│      │
│  │   (Public)   │  │ (Encrypted)  │  │ (ACL Gated)  │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                  │                  │               │
│         └──────────────────┼──────────────────┘               │
│                            │ fhevmjs (Client Encryption)      │
└────────────────────────────┼──────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                 ConfidentialRealEstate.sol                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Property (Public)       │ Shareholder (Mixed)        │   │
│  │ - price: uint256        │ - sharesOwned: euint64 🔒  │   │
│  │ - totalShares: uint256  │ - rentClaimed: uint256     │   │
│  │ - rent: uint256         │                            │   │
│  │ - rentPool: uint256     │ ACL: owner + shareholder   │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────────────┬─────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    FHEVM Infrastructure                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │ Gateway  │◄─┤Coprocessor│◄─┤   KMS    │◄─┤ TFHE Lib │    │
│  │(Decrypt) │  │(Compute)  │  │(KeyMgmt) │  │(Encrypt) │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## 📋 Features

### Core Functionality
- ✅ **List Properties**: Tokenize real estate into fractional shares
- ✅ **Encrypted Purchases**: Buy shares with encrypted amounts (euint64)
- ✅ **Rent Distribution**: Automatic rent claiming based on encrypted holdings
- ✅ **Secondary Marketplace**: Transfer encrypted shares between users
- ✅ **Access Control**: ACL ensures only authorized parties decrypt balances

### Privacy Model
| Data Type | Visibility | Type |
|-----------|-----------|------|
| Share ownership | 🔒 Private (Shareholder + Owner) | `euint64` |
| Property price | 🌐 Public | `uint256` |
| Rent amount | 🌐 Public | `uint256` |
| Total shares | 🌐 Public | `uint256` |
| Rent pool | 🌐 Public | `uint256` |

## 🚀 Quick Start

### Prerequisites
- Node.js v18+
- npm or yarn
- MetaMask or Web3 wallet
- Access to Sepolia testnet or local FHEVM node

### Installation

```bash
# Clone the repository
cd confidential-realestate

# Install dependencies
npm install

# Copy environment template
cp .env.example .env
```

### Configure Environment

Edit `.env` with your credentials:

```env
PRIVATE_KEY=your_wallet_private_key_here
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
```

### Compile Contracts

```bash
npm run compile
```

Expected output:
```
Compiled 3 Solidity files successfully
```

### Run Tests

```bash
npm test
```

### Deploy to Sepolia Testnet

```bash
npm run deploy
```

Expected output:
```
🚀 Deploying ConfidentialRealEstate contract...
✅ ConfidentialRealEstate deployed to: 0x...
```

### Deploy to Local FHEVM

```bash
# Start local FHEVM node first (see below)
npm run deploy:local
```

## 🧪 Testing

### Run Test Suite

```bash
npm test
```

Tests cover:
- ✅ Property listing
- ✅ Share purchase (encrypted)
- ✅ Rent payment & distribution
- ✅ ACL enforcement
- ✅ Edge cases & error handling

### Test with Local FHEVM

For full encrypted testing, use Zama's local FHEVM:

```bash
# Clone FHEVM
git clone https://github.com/zama-ai/fhevm.git
cd fhevm

# Start local node
npm install
npm run fhevm:start

# In another terminal, run tests
cd confidential-realestate
npm test
```

## 📖 Usage Examples

### 1. List a Property

```javascript
const tx = await contract.listProperty(
  ownerAddress,
  "Luxury Beachfront Villa",
  ethers.parseEther("100"), // 100 ETH total price
  1000, // 1000 shares
  ethers.parseEther("1"), // 1 ETH rent per period
  30, // 30 days rent period
  "ipfs://QmImages...",
  "A stunning 5-bedroom villa with ocean views",
  "123 Beach Road, Miami, FL"
);
```

### 2. Purchase Shares (Encrypted)

**Frontend with fhevmjs:**

```javascript
import { createInstance } from "fhevmjs";

// Initialize FHEVM instance
const instance = await createInstance({ chainId: 11155111 });

// Encrypt share amount client-side
const sharesToBuy = 100;
const encrypted = await instance.encrypt64(sharesToBuy);

// Purchase shares with encrypted input
const tx = await contract.purchaseShares(
  propertyId,
  encrypted.handles[0],
  encrypted.inputProof,
  { value: totalCost }
);
```

### 3. View Encrypted Holdings (Authorized Users Only)

```javascript
// Get shareholder info
const info = await contract.getShareholderInfo(propertyId, shareholderAddress);

// Decrypt shares (only works if you're authorized via ACL)
const decryptedShares = await instance.decrypt(info.encryptedShares);
console.log("You own:", decryptedShares, "shares");
```

### 4. Pay Rent

```javascript
const rentAmount = ethers.parseEther("1");
const tx = await contract.payRent(propertyId, payerAddress, {
  value: rentAmount
});
```

### 5. Claim Rent

```javascript
// Shareholder claims their proportional rent
const tx = await contract.claimRent(propertyId, shareholderAddress);
```

## 🔒 Security Features

### Access Control List (ACL)

The contract implements TFHE ACLs to control who can decrypt encrypted data:

```solidity
// In purchaseShares() function:
TFHE.allow(shareholder.sharesOwned, msg.sender);      // Shareholder can decrypt
TFHE.allow(shareholder.sharesOwned, property.owner);  // Property owner can decrypt
TFHE.allow(shareholder.sharesOwned, address(this));   // Contract can compute
```

**Unauthorized decryption attempts will revert automatically.**

### Privacy Guarantees

- ✅ Share amounts encrypted end-to-end (client → blockchain)
- ✅ Computations on encrypted data (FHE addition, comparison)
- ✅ Zero-knowledge: Blockchain sees ciphertext only
- ✅ No trusted setup required (TFHE-based)

## 🛠️ Development

### Project Structure

```
confidential-realestate/
├── contracts/
│   └── ConfidentialRealEstate.sol   # Main contract with FHE
├── scripts/
│   ├── deploy.js                     # Deployment script
│   └── interact.js                   # Example interactions
├── test/
│   └── ConfidentialRealEstate.test.js
├── hardhat.config.js
├── package.json
└── README.md
```

### Key Dependencies

- **fhevm** (v0.5.0): Zama's FHEVM Solidity library
- **fhevm-core-contracts** (v0.5.0): Core FHEVM infrastructure
- **hardhat** (v2.19.0): Development environment
- **fhevmjs**: Client-side encryption library (for frontend)

### Hardhat Configuration

**Solidity Version:** 0.8.24 (Cancun EVM)

**Networks:**
- `sepolia`: Ethereum Sepolia testnet (Chain ID: 11155111)
- `localfhevm`: Local FHEVM node (Chain ID: 9000)

### Interact with Deployed Contract

```bash
# Run interaction script
npx hardhat run scripts/interact.js --network sepolia
```

## 📊 Gas Optimization

FHE operations are more expensive than standard operations:

| Operation | Gas Cost (Approx) |
|-----------|-------------------|
| TFHE.asEuint64() | ~50,000 gas |
| TFHE.add() | ~30,000 gas |
| TFHE.le() (comparison) | ~35,000 gas |
| TFHE.decrypt() | ~100,000 gas |

**Optimization strategies:**
- Batch decryptions when possible
- Use Gateway for off-chain decryption requests
- Cache decrypted values client-side
- Minimize encrypted comparisons

## 🚧 Roadmap

### Phase 1 (Current - Testnet MVP) ✅
- [x] Encrypted share holdings
- [x] ACL implementation
- [x] Basic rent distribution
- [x] Sepolia deployment

### Phase 2 (Next)
- [ ] Secondary marketplace with encrypted listings
- [ ] Encrypted rent amounts
- [ ] Multi-property portfolio views
- [ ] Frontend dApp with fhevmjs

### Phase 3 (Future)
- [ ] KYC/AML integration
- [ ] Governance voting with encrypted ballots
- [ ] Mainnet deployment (when FHEVM v1.0 stable)
- [ ] Mobile app

## 🔗 Resources

### Zama Documentation
- [FHEVM Overview](https://docs.zama.ai/fhevm)
- [TFHE Library](https://docs.zama.ai/fhevm/fundamentals/types)
- [fhevmjs Client Library](https://docs.zama.ai/fhevm/guides/frontend)
- [ACL Guide](https://docs.zama.ai/fhevm/guides/acl)

### Original Xuel Platform
- GitHub: [samuel025/Xuel-TokenizationPlatform](https://github.com/samuel025/Xuel-TokenizationPlatform)
- Contract: `0x039B0a4E5C69CD5C356c8d94d86C79BD208Ea3ad` (Arbitrum Sepolia)

### Community
- [Zama Discord](https://discord.gg/zama)
- [Zama GitHub](https://github.com/zama-ai)

## ⚠️ Disclaimers

- **Testnet Only**: This is a testnet MVP. Do not use in production.
- **FHEVM Beta**: FHEVM is in beta (v0.9). Breaking changes expected in v0.10+.
- **Not Audited**: Contracts have not been professionally audited.
- **Educational Purpose**: Built for learning FHE integration, not production use.

## 📄 License

MIT License - see LICENSE file for details

## 🤝 Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Add tests for new features
4. Submit a pull request

## 📧 Support

- Issues: [GitHub Issues](https://github.com/yourusername/confidential-realestate/issues)
- Zama Support: [Discord](https://discord.gg/zama)

---

**Built with** ❤️ **using Zama FHEVM**

*Privacy-preserving real estate for everyone* 🏠🔒
