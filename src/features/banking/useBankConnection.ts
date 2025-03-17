// src/features/banking/useBankConnection.ts
import { useState, useCallback } from 'react';
import { Transaction } from '@/shared/types/transactions';

interface ConnectionStatus {
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
}

interface UseBankConnectionResult {
  connectionStatus: ConnectionStatus;
  transactions: Transaction[];
  connectBank: (publicToken: string) => Promise<void>;
  disconnectBank: () => void;
}

export function useBankConnection(): UseBankConnectionResult {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    isConnected: false,
    isLoading: false,
    error: null
  });

  // Simple function to connect bank and retrieve transactions
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

      // Store access token in localStorage for recovery in case of page refresh
      try {
        localStorage.setItem('plaid_access_token', tokenData.access_token);
      } catch (error) {
        console.warn("Could not store access token in localStorage:", error);
      }

      // Mark connection as successful even before retrieving transactions
      setConnectionStatus({
        isConnected: true,
        isLoading: true,
        error: null
      });

      // Now get transactions
      const transactionsResponse = await fetch("/api/banking/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token: tokenData.access_token }),
      });

      if (!transactionsResponse.ok) {
        throw new Error(`Failed to retrieve transactions: ${transactionsResponse.status}`);
      }

      const transactionsData = await transactionsResponse.json();
      
      // Initialize transactions with analysis placeholders
      const initializedTransactions = transactionsData.map((tx: Transaction) => ({
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
  }, []);

  // Disconnect bank function
  const disconnectBank = useCallback(() => {
    console.log("Disconnecting bank account");
    
    // Clear any stored access token
    try {
      localStorage.removeItem('plaid_access_token');
    } catch (error) {
      console.warn("Could not remove access token from localStorage:", error);
    }
    
    // Reset state
    setTransactions([]);
    setConnectionStatus({
      isConnected: false,
      isLoading: false,
      error: null
    });
  }, []);

  return {
    connectionStatus,
    transactions,
    connectBank,
    disconnectBank
  };
}