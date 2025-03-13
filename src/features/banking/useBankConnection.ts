// src/features/banking/useBankConnection.ts
import { useState, useCallback } from 'react';
import { Transaction } from '@/shared/types/transactions';
import { config } from '@/config';

interface ConnectionStatus {
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
}

interface ConnectionOptions {
  skipTokenExchange?: boolean;
  sampleData?: Transaction[];
}

interface UseBankConnectionResult {
  connectionStatus: ConnectionStatus;
  transactions: Transaction[];
  connectBank: (publicToken: string | null, options?: ConnectionOptions) => Promise<void>;
  setTransactions: (transactions: Transaction[]) => void; // Added for direct setting
}

export function useBankConnection(): UseBankConnectionResult {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    isConnected: false,
    isLoading: false,
    error: null
  });

  const fetchTransactions = useCallback(async (accessToken: string, maxRetries = 2): Promise<Transaction[]> => {
    let currentRetry = 0;
    
    while (currentRetry <= maxRetries) {
      try {
        const response = await fetch("/api/banking/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ access_token: accessToken }),
        });

        // Handle product not ready (transient error)
        if (response.status === 503) {
          if (currentRetry < maxRetries) {
            currentRetry++;
            console.log(`Transactions not ready, retry ${currentRetry}/${maxRetries}...`);
            await new Promise(resolve => setTimeout(resolve, 3000));
            continue;
          } else {
            throw new Error("Transactions data not available yet. Please try again later.");
          }
        }

        if (!response.ok) {
          throw new Error(`Server error: ${response.status}`);
        }

        const data = await response.json();
        if (!Array.isArray(data) || data.length === 0) {
          throw new Error("No transactions found in your account.");
        }
        
        return data;
      } catch (error) {
        if (currentRetry < maxRetries) {
          currentRetry++;
          continue;
        }
        throw error;
      }
    }
    
    throw new Error("Failed to fetch transactions after retries");
  }, []);

  const connectBank = useCallback(async (publicToken: string | null, options?: ConnectionOptions) => {
    // Allow early return for options.skipTokenExchange
    // This is used by the local sample data feature
    if (options?.skipTokenExchange) {
      console.log("Skipping token exchange and using provided sample data");
      
      // Just mark as connected
      setConnectionStatus({
        isConnected: true,
        isLoading: false,
        error: null
      });
      
      // No need to do anything else - transactions will be set directly
      return;
    }
  
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
      // Handle sample data mode
      if (config.plaid.useSampleData) {
        console.log("Using sample data mode");
        
        const response = await fetch("/api/banking/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ useSampleData: true }),
        });

        if (!response.ok) {
          throw new Error(`Server error: ${response.status}`);
        }

        const data = await response.json();
        
        // Initialize transactions with analysis placeholders
        const initializedTransactions = data.map((tx: Transaction) => ({
          ...tx,
          societalDebt: 0,
          unethicalPractices: [],
          ethicalPractices: [],
          information: {},
          analyzed: false
        }));
        
        setTransactions(initializedTransactions);
        
        setConnectionStatus({
          isConnected: true,
          isLoading: false,
          error: null
        });
        
        return;
      }

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

      // Fetch transactions with the access token
      const fetchedTransactions = await fetchTransactions(tokenData.access_token);
      
      // Initialize transactions with analysis placeholders
      const initializedTransactions = fetchedTransactions.map(tx => ({
        ...tx,
        societalDebt: 0,
        unethicalPractices: [],
        ethicalPractices: [],
        information: {},
        analyzed: false
      }));
      
      setTransactions(initializedTransactions);
      
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
  }, [fetchTransactions]);

  // Direct setter for transactions
  // This allows bypassing the Plaid API entirely for testing
  const setTransactionsDirect = useCallback((newTransactions: Transaction[]) => {
    // Mark as connected if we're setting transactions directly
    setConnectionStatus({
      isConnected: true,
      isLoading: false,
      error: null
    });
    
    // Initialize transactions with analysis placeholders
    const initializedTransactions = newTransactions.map(tx => ({
      ...tx,
      societalDebt: 0,
      unethicalPractices: [],
      ethicalPractices: [],
      information: {},
      analyzed: false
    }));
    
    setTransactions(initializedTransactions);
  }, []);

  return {
    connectionStatus,
    transactions,
    connectBank,
    setTransactions: setTransactionsDirect
  };
}