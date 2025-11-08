# Confidential Real Estate

Privacy-preserving fractional real estate platform built with Zama FHEVM. Share ownership is encrypted on-chain — only you and the property owner can see your holdings.

live at: https://covert-realty.vercel.app/

video demo: https://www.loom.com/share/26ededca7ae94b9e853cb5f2546aa434

## What's This?

Buy fractional shares in tokenized real estate properties. Your share balances are fully encrypted using homomorphic encryption, while property prices, rent amounts, and transaction activity remain public for transparency.

## Stack

- **Smart Contract**: Solidity 0.8.27 with Zama FHEVM
- **Frontend**: Next.js 16 + TypeScript + Tailwind
- **Encryption**: fhevmjs 0.8.0 (client-side), FHE operations (on-chain)
- **Storage**: IPFS via Pinata (property images)
- **Network**: Sepolia testnet

## Features

- **List Properties**: Tokenize properties into shares with rent periods
- **Buy Shares**: Purchase shares with payment in ETH (share count encrypted as `euint64`)
- **Encrypted Balances**: Only you + property owner can decrypt your holdings (ACL enforced)
- **Rent Distribution**: Claim proportional rent based on encrypted share ownership
- **Property Management**: Owners can pay rent, pause listings, and view shareholders
- **IPFS Images**: Upload property images directly to IPFS

## Privacy Model

| Data | Visibility |
|------|-----------|
| **Share balances** | 🔒 Encrypted (`euint64`) — shareholder + owner only |
| Property prices | 🌐 Public |
| Rent amounts | 🌐 Public |
| Total shares | 🌐 Public |
| Transaction activity | 🌐 Public |

## Quick Start

### 1. Install Dependencies

```bash
# Install contract dependencies
npm install

# Install frontend dependencies
cd frontend
npm install
```

### 2. Configure Environment

**Root `.env`** (for contract deployment):
```bash
PRIVATE_KEY=your_wallet_private_key
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
```

**`frontend/.env.local`** (for app):
```bash
NEXT_PUBLIC_NETWORK=sepolia
NEXT_PUBLIC_CONTRACT_ADDRESS=your_deployed_contract_address
PINATA_JWT=your_pinata_jwt_for_image_uploads
```

### 3. Deploy Contract

```bash
npm run compile
npm run deploy
```

Copy the deployed contract address to `frontend/.env.local`.

### 4. Run Frontend

```bash
cd frontend
npm run dev
```

Open http://localhost:3000

## How It Works

### Smart Contract

**`ConfidentialRealEstate.sol`** inherits from `SepoliaConfig` (Zama):

```solidity
struct Shareholder {
    euint64 sharesOwned;  // ENCRYPTED
    uint256 rentClaimed;  // Public
    uint256 lastClaimTimestamp;
}

// Purchase shares - numShares stored encrypted
function purchaseShares(uint256 _propertyId, uint64 numShares) external payable {
    // ...
    shareholder.sharesOwned = FHE.add(shareholder.sharesOwned, FHE.asEuint64(numShares));
    
    // ACL: Only shareholder and owner can decrypt
    FHE.allow(shareholder.sharesOwned, msg.sender);
    FHE.allow(shareholder.sharesOwned, property.owner);
    FHE.allowThis(shareholder.sharesOwned);
}
```

### Frontend Decryption

Uses Zama Relayer SDK to decrypt authorized balances:

```typescript
// Generate keypair
const { publicKey, privateKey } = relayerInstance.generateKeypair();

// Sign EIP-712 for authorization
const signature = await signer.signTypedData(domain, types, message);

// Decrypt via gateway
const decrypted = await relayerInstance.userDecrypt(
  handles, privateKey, publicKey, signature, ...
);
```

## Contract Functions

| Function | Description |
|----------|-------------|
| `listProperty()` | List a property with shares, price, rent |
| `purchaseShares()` | Buy shares (encrypted balance update) |
| `payRent()` | Property owner deposits rent to pool |
| `claimRent()` | Shareholders claim proportional rent |
| `getShareholderInfo()` | View encrypted handle + public data |
| `pauseProperty()` | Pause/resume listings |
| `updatePropertyDetails()` | Update name, description, images |

## Pages

- **`/`** — Browse & buy shares in listed properties
- **`/list`** — List new properties (IPFS image upload)
- **`/dashboard`** — View your investments & decrypt balances
- **`/manage`** — Manage properties you own (pay rent, view shareholders)

## Development

### Run Tests

```bash
npm test
```

Tests cover property listing, share purchases, rent distribution, and ACL enforcement.

### Project Structure

```
confidential-realestate/
├── contracts/
│   └── ConfidentialRealEstate.sol
├── scripts/
│   ├── deploy.js
│   └── interact.js
├── test/
│   └── ConfidentialRealEstate.test.js
├── frontend/
│   ├── app/                 # Next.js pages
│   ├── components/          # React components
│   └── lib/                 # Contract ABI, FHEVM utils
└── hardhat.config.js
```

### Key Dependencies

**Contracts:**
- `@fhevm/solidity` ^0.8.0
- `ethers` ^6.9.0
- `hardhat` ^2.25.0

**Frontend:**
- `next` 16.0.0
- `fhevmjs` ^0.6.2
- `ethers` ^6.15.0

## Known Issues

- **Zama Gateway**: Decryption requires the Zama relayer to be operational. If you see HTTP 500 errors, the gateway may be temporarily down.
- **Network**: Currently only supports Sepolia testnet (localhost FHEVM support partial).
- **Gas Costs**: FHE operations are expensive (~50k gas for encryption, ~100k for decryption).

## Resources

- [Zama FHEVM Docs](https://docs.zama.ai/fhevm)
- [fhevmjs Guide](https://docs.zama.ai/fhevm/getting_started/fhevmjs)
- [Sepolia Faucet](https://sepoliafaucet.com/)
- [Pinata IPFS](https://pinata.cloud)

## License

MIT
