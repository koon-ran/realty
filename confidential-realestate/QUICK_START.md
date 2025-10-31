# Quick Start Guide

## Prerequisites
- MetaMask installed
- Sepolia ETH for gas fees
- Pinata account (for image uploads)

## Setup

### 1. Get Your Pinata JWT
1. Go to https://pinata.cloud
2. Sign up/login
3. Navigate to API Keys
4. Create a new API key with pinning permissions
5. Copy the JWT token

### 2. Configure Environment
```bash
cd /workspaces/dewzam/confidential-realestate/frontend
```

Edit `.env.local` and add your Pinata JWT:
```bash
PINATA_JWT=your_actual_jwt_token_here
```

### 3. Start the Development Server
```bash
npm run dev
```

The app will be available at http://localhost:3000

## Testing the App

### 1. Connect Wallet
- Click "Connect Wallet" button
- Approve MetaMask connection
- Make sure you're on Sepolia network

### 2. List a Property
- Click "+ List Property"
- Fill in property details
- Upload photos (they'll be pinned to IPFS via Pinata)
- Submit transaction

### 3. Browse Properties
- View all listed properties on the homepage
- Search and filter by price
- Click "Buy Shares" to purchase

### 4. Manage Your Properties
- Click your profile icon → "My Properties"
- View properties you own
- Pay rent to shareholders
- Decrypt shareholder balances (FHEVM)
- Update property details and add more photos

### 5. View Your Investments
- Click your profile icon → "My Investments"
- See properties where you own shares
- Decrypt your share balance
- Claim rent payments

## Features

### Privacy (FHEVM)
- Share balances are encrypted on-chain
- Only property owners can decrypt shareholder data
- Shareholders can decrypt their own balances

### Image Uploads
- Images uploaded through Pinata are permanently stored on IPFS
- Multiple images per property supported
- Comma-separated URLs also work

### Property Management
- Pay rent to shareholders
- Pause/resume listings
- Update property details
- View shareholder list with encrypted balances

## Troubleshooting

### "Pinata credentials not configured"
- Make sure `PINATA_JWT` is set in `frontend/.env.local`
- Restart the dev server after adding the JWT

### "Failed to connect wallet"
- Ensure MetaMask is installed
- Switch to Sepolia network
- Check you have ETH for gas

### "FHEVM not ready"
- Wait a few seconds for FHEVM SDK to load
- Refresh the page if needed
- Only works on Sepolia network

### Build Warnings
- The 3 `<img>` warnings in manage page are acceptable (Next.js optimization suggestion)
- All TypeScript errors are resolved

## Network Info
- **Network**: Sepolia Testnet
- **Chain ID**: 11155111
- **Contract**: Check `frontend/.env.local` for deployed address

## Next Steps
- Get Sepolia ETH from a faucet
- List your first property
- Test the full workflow
- Experiment with encrypted share balances
