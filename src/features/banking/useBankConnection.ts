// src/features/banking/useBankConnection.ts
import { useState, useCallback, useEffect } from 'react';
import { User } from 'firebase/auth';
import { Transaction } from '@/shared/types/transactions';

interface ConnectionStatus {
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
}

interface AccessTokenInfo {
  token: string;
  userId: string;
  timestamp: number;
}

interface UseBankConnectionResult {
  connectionStatus: ConnectionStatus;
  transactions: Transaction[];
  connectBank: (publicToken: string) => Promise<void>;
  disconnectBank: () => void;
  autoReconnectBank: () => Promise<boolean>;
}

export function useBankConnection(user: User | null): UseBankConnectionResult {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    isConnected: false,
    isLoading: false,
    error: null
  });

  // Function to store access token securely
  const storeAccessToken = useCallback((accessToken: string) => {
    if (!user) return;
    
    try {
      // Create token info with user ID and timestamp
      const tokenInfo: AccessTokenInfo = {
        token: accessToken,
        userId: user.uid,
        timestamp: Date.now()
      };
      
      // Store in localStorage - in a real app, consider more secure options
      localStorage.setItem('plaid_access_token_info', JSON.stringify(tokenInfo));
      console.log("🔐 Access token stored successfully");
    } catch (error) {
      console.warn("Could not store access token:", error);
    }
  }, [user]);
  
  // Function to retrieve stored access token
  const getStoredAccessToken = useCallback((): string | null => {
    if (!user) return null;
    
    try {
      const storedData = localStorage.getItem('plaid_access_token_info');
      if (!storedData) return null;
      
      const tokenInfo: AccessTokenInfo = JSON.parse(storedData);
      
      // Verify the token belongs to current user
      if (tokenInfo.userId !== user.uid) {
        console.warn("Stored token belongs to a different user");
        localStorage.removeItem('plaid_access_token_info');
        return null;
      }
      
      // Verify token isn't too old (30 days expiry)
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
      if (Date.now() - tokenInfo.timestamp > thirtyDaysMs) {
        console.warn("Stored token has expired");
        localStorage.removeItem('plaid_access_token_info');
        return null;
      }
      
      return tokenInfo.token;
    } catch (error) {
      console.warn("Error retrieving stored access token:", error);
      return null;
    }
  }, [user]);

  // Function to fetch transactions with a given access token
  const fetchTransactions = useCallback(async (accessToken: string): Promise<Transaction[]> => {
    const response = await fetch("/api/banking/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ access_token: accessToken }),
    });

    if (!response.ok) {
      throw new Error(`Failed to retrieve transactions: ${response.status}`);
    }

    const transactionsData = await response.json();
    
    // Initialize transactions with analysis placeholders
    return transactionsData.map((tx: Transaction) => ({
      ...tx,
      societalDebt: 0,
      unethicalPractices: [],
      ethicalPractices: [],
      information: {},
      analyzed: false
    }));
  }, []);

  // Connect bank function - called after Plaid Link success
  const connectBank = useCallback(async (publicToken: string) => {
    if (!publicToken) {
      setConnectionStatus({
        isConnected: false,
        isLoading: false,
        error: "No public token provided"
      });
      return;
    }

    setConnectionStatus({
      isConnected: false,
      isLoading: true,
      error: null
    });

    try {
      // Exchange public token for access token
      const tokenResponse = await fetch("/api/banking/exchange_token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public_token: publicToken }),
      });

      if (!tokenResponse.ok) {
        throw new Error("Failed to exchange Plaid token");
      }

      const tokenData = await tokenResponse.json();
      
      if (!tokenData.access_token) {
        throw new Error("No access token received from Plaid");
      }

      // Store the access token securely
      storeAccessToken(tokenData.access_token);

      // Mark connection as successful even before retrieving transactions
      setConnectionStatus({
        isConnected: true,
        isLoading: true,
        error: null
      });

      // Now get transactions
      const fetchedTransactions = await fetchTransactions(tokenData.access_token);
      setTransactions(fetchedTransactions);
      
      setConnectionStatus({
        isConnected: true,
        isLoading: false,
        error: null
      });
      
    } catch (error) {
      console.error("Bank connection error:", error);
      
      setConnectionStatus({
        isConnected: false,
        isLoading: false,
        error: error instanceof Error ? error.message : "Failed to connect bank account"
      });
    }
  }, [storeAccessToken, fetchTransactions]);

  // Auto reconnect function - called on component mount to restore previous connection
  const autoReconnectBank = useCallback(async (): Promise<boolean> => {
    // Don't try to reconnect if we're already connected or if there's no user
    if (connectionStatus.isConnected || !user) {
      return false;
    }
    
    setConnectionStatus({
      isConnected: false,
      isLoading: true,
      error: null
    });
    
    try {
      // Try to get the stored access token
      const accessToken = getStoredAccessToken();
      
      if (!accessToken) {
        console.log("No stored access token found - cannot auto-reconnect");
        setConnectionStatus({
          isConnected: false,
          isLoading: false,
          error: null // Don't show error for this case
        });
        return false;
      }
      
      console.log("🔄 Auto-reconnecting with stored access token");
      
      // Verify the access token is still valid by fetching transactions
      const fetchedTransactions = await fetchTransactions(accessToken);
      setTransactions(fetchedTransactions);
      
      // Update connection status
      setConnectionStatus({
        isConnected: true,
        isLoading: false,
        error: null
      });
      
      console.log("✅ Auto-reconnect successful");
      return true;
    } catch (error) {
      console.error("Auto-reconnect failed:", error);
      
      // Clear the stored token since it's invalid
      localStorage.removeItem('plaid_access_token_info');
      
      setConnectionStatus({
        isConnected: false,
        isLoading: false,
        error: null // Don't show error to user for auto-reconnect
      });
      
      return false;
    }
  }, [connectionStatus.isConnected, user, getStoredAccessToken, fetchTransactions]);

  // Disconnect bank function
  const disconnectBank = useCallback(() => {
    console.log("Disconnecting bank account");
    
    // Clear stored access token
    localStorage.removeItem('plaid_access_token_info');
    
    // Reset state
    setTransactions([]);
    setConnectionStatus({
      isConnected: false,
      isLoading: false,
      error: null
    });
  }, []);

  // Auto-reconnect on initial load
  useEffect(() => {
    if (user && !connectionStatus.isConnected && !connectionStatus.isLoading) {
      autoReconnectBank().catch(err => {
        console.error("Error in auto-reconnect:", err);
      });
    }
  }, [user, connectionStatus.isConnected, connectionStatus.isLoading, autoReconnectBank]);

  return {
    connectionStatus,
    transactions,
    connectBank,
    disconnectBank,
    autoReconnectBank
  };
}