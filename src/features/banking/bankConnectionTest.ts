// src/features/banking/bankConnectionTest.ts

/**
 * Test utility to verify the state of bank connections
 * This can be used for debugging or in the development environment
 */
export function testBankConnection(): {
    hasStoredToken: boolean;
    tokenInfo: string | null;
    isValid: boolean;
  } {
    try {
      // Check if token exists in localStorage
      const storedData = localStorage.getItem('plaid_access_token_info');
      if (!storedData) {
        return {
          hasStoredToken: false,
          tokenInfo: null,
          isValid: false
        };
      }
      
      // Parse token info
      const tokenInfo = JSON.parse(storedData);
      
      // Verify structure
      if (!tokenInfo.token || !tokenInfo.userId || !tokenInfo.timestamp) {
        return {
          hasStoredToken: true,
          tokenInfo: JSON.stringify(tokenInfo, null, 2),
          isValid: false
        };
      }
      
      // Check token age
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
      const tokenAge = Date.now() - tokenInfo.timestamp;
      const isExpired = tokenAge > thirtyDaysMs;
      
      return {
        hasStoredToken: true,
        tokenInfo: JSON.stringify({
          userId: tokenInfo.userId,
          tokenAge: Math.floor(tokenAge / (24 * 60 * 60 * 1000)) + ' days',
          isExpired
        }, null, 2),
        isValid: !isExpired
      };
    } catch (error) {
      return {
        hasStoredToken: false,
        tokenInfo: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        isValid: false
      };
    }
  }
  
  /**
   * Clear any stored bank connection tokens
   * Can be used for testing or debugging
   */
  export function clearBankConnectionToken(): void {
    try {
      localStorage.removeItem('plaid_access_token_info');
      console.log('✅ Bank connection token cleared');
    } catch (error) {
      console.error('Failed to clear bank token:', error);
    }
  }