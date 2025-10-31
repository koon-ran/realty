/**
 * Parse blockchain errors into user-friendly messages
 */
export function parseBlockchainError(error: unknown): string {
  // Type guard for error objects
  const err = error as {
    code?: string | number;
    reason?: string;
    message?: string;
    data?: { message?: string };
    error?: { message?: string };
  };

  // Handle custom contract errors
  if (err.data && typeof err.data === 'object' && 'message' in err.data) {
    const dataMessage = err.data.message;
    if (typeof dataMessage === 'string') {
      // Extract revert reason from data
      if (dataMessage.includes('InsufficientShares')) {
        return "Not enough shares available. Please reduce the number of shares you want to purchase.";
      }
      if (dataMessage.includes('InvalidAmount')) {
        return "Invalid payment amount. Please check the amount and try again.";
      }
      if (dataMessage.includes('NotAuthorized')) {
        return "You are not authorized to perform this action.";
      }
      if (dataMessage.includes('RentAlreadyPaid')) {
        return "Rent has already been paid for the current period.";
      }
      if (dataMessage.includes('NoRentToClaim')) {
        return "There is no rent available to claim at this time.";
      }
      if (dataMessage.includes('PropertyNotActive')) {
        return "This property is currently paused and not accepting purchases.";
      }
      if (dataMessage.includes('PropertyAlreadyPaused')) {
        return "This property is already paused.";
      }
      if (dataMessage.includes('PropertyAlreadyActive')) {
        return "This property is already active.";
      }
    }
  }

  // Handle user rejection
  if (err.code === 4001 || err.code === 'ACTION_REJECTED') {
    return "Transaction was rejected. Please try again.";
  }

  // Handle insufficient funds
  if (err.code === -32000 || err.reason?.includes('insufficient funds')) {
    return "Insufficient funds. Please add more ETH to your wallet.";
  }

  // Handle gas estimation errors
  if (err.message?.includes('gas required exceeds allowance') || err.message?.includes('out of gas')) {
    return "Gas limit too low. The transaction might fail. Please try with more gas.";
  }

  // Handle network errors
  if (err.message?.includes('network') || err.message?.includes('fetch')) {
    return "Network error. Please check your connection and try again.";
  }

  // Handle nonce errors
  if (err.message?.includes('nonce')) {
    return "Transaction nonce error. Please reset your MetaMask account or try again.";
  }

  // Handle replacement transaction errors
  if (err.code === 'REPLACEMENT_UNDERPRICED') {
    return "Previous transaction still pending. Please wait or increase gas price.";
  }

  // Handle timeout
  if (err.code === 'TIMEOUT') {
    return "Transaction timeout. The transaction may still be processing. Check your wallet history.";
  }

  // Handle unpredictable gas limit
  if (err.code === 'UNPREDICTABLE_GAS_LIMIT') {
    return "Cannot estimate gas. The transaction may fail. Please check the parameters.";
  }

  // Generic error with reason
  if (err.reason) {
    return `Transaction failed: ${err.reason}`;
  }

  // Generic error with message
  if (err.message) {
    // Clean up technical error messages
    const message = err.message;
    if (message.includes('execution reverted')) {
      return "Transaction reverted. Please check the transaction parameters.";
    }
    return message.length > 200 ? message.substring(0, 200) + '...' : message;
  }

  return "An unknown error occurred. Please try again.";
}

/**
 * Show user-friendly error alert
 */
export function showError(error: unknown, context?: string): void {
  const message = parseBlockchainError(error);
  const fullMessage = context ? `${context}\n\n${message}` : message;
  
  console.error('Error:', error);
  alert(fullMessage);
}

/**
 * Validate ETH amount
 */
export function validateEthAmount(amount: string): { valid: boolean; error?: string } {
  if (!amount || amount.trim() === '') {
    return { valid: false, error: 'Amount is required' };
  }

  const parsed = parseFloat(amount);
  if (isNaN(parsed)) {
    return { valid: false, error: 'Amount must be a valid number' };
  }

  if (parsed <= 0) {
    return { valid: false, error: 'Amount must be greater than 0' };
  }

  if (parsed > 1000000) {
    return { valid: false, error: 'Amount is too large' };
  }

  return { valid: true };
}

/**
 * Validate shares amount
 */
export function validateShares(shares: string, available?: bigint): { valid: boolean; error?: string } {
  if (!shares || shares.trim() === '') {
    return { valid: false, error: 'Shares amount is required' };
  }

  try {
    const parsed = BigInt(shares);
    
    if (parsed <= BigInt(0)) {
      return { valid: false, error: 'Shares must be greater than 0' };
    }

    if (available !== undefined && parsed > available) {
      return { valid: false, error: `Only ${available.toString()} shares available` };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: 'Shares must be a valid number' };
  }
}

/**
 * Format error for logging
 */
export function formatErrorForLog(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}\n${error.stack || ''}`;
  }
  return JSON.stringify(error, null, 2);
}
