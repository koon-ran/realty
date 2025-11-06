'use client';

import { useEffect, useRef } from 'react';
import { TARGET_NETWORK } from '@/lib/config';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastProps {
  message: string;
  type: ToastType;
  onClose: () => void;
  duration?: number;
}

export default function Toast({ message, type, onClose, duration = 5000 }: ToastProps) {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const bgColor = {
    success: 'bg-green-600',
    error: 'bg-red-600',
    info: 'bg-blue-600',
    warning: 'bg-yellow-600',
  }[type];

  const icon = {
    success: '✓',
    error: '✕',
    info: 'ℹ',
    warning: '⚠',
  }[type];

  // Check if message contains a transaction hash
  const txHashMatch = message.match(/0x[a-fA-F0-9]{64}/);
  
  const renderMessage = () => {
    if (txHashMatch) {
      const txHash = txHashMatch[0];
      const parts = message.split(txHash);
      const explorerBaseUrl = TARGET_NETWORK.blockExplorerUrls[0];
      const explorerUrl = `${explorerBaseUrl}/tx/${txHash}`;
      
      return (
        <span className="text-sm">
          {parts[0]}
          <a 
            href={explorerUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="underline hover:text-gray-200 font-semibold"
            onClick={(e) => e.stopPropagation()}
          >
            {txHash.slice(0, 10)}...{txHash.slice(-8)}
          </a>
          {parts[1]}
        </span>
      );
    }
    
    return <span className="text-sm">{message}</span>;
  };

  return (
    <div className={`${bgColor} text-white px-6 py-4 rounded-lg shadow-lg flex items-center justify-between min-w-[300px] max-w-md animate-slide-in`}>
      <div className="flex items-center gap-3">
        <span className="text-xl font-bold">{icon}</span>
        {renderMessage()}
      </div>
      <button
        onClick={onClose}
        className="ml-4 text-white hover:text-gray-200 text-lg font-bold"
        aria-label="Close"
      >
        ×
      </button>
    </div>
  );
}
