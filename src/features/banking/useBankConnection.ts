// src/features/banking/useBankConnection.ts
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { User } from 'firebase/auth';
import { Transaction } from '@/shared/types/transactions';
import { ConnectionStatus, bankConnectionService, DisconnectionOptions } from './bankConnectionService';
import { ConnectionDiagnostic } from './ConnectionDiagnostic';
import { useTransactionStorage } from '@/features/analysis/useTransactionStorage';

interface UseBankConnectionResult {
  connectionStatus: ConnectionStatus;
  transactions: Transaction[];
  connectBank: (publicToken: string) => Promise<void>;
  disconnectBank: (options?: DisconnectionOptions) => Promise<boolean>;
  emergencyDisconnect: () => Promise<boolean>;
  clearSavedTransactions: () => void;
  resetConnection: () => void; // Function to reset connection state
  ConnectionDebugPanel: React.FC; // Debug panel component
  setExternalTransactions: (externalTransactions: Transaction[]) => void; // New function to set transactions from external source
}

export function useBankConnection(user: User | null): UseBankConnectionResult {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    isConnected: false,
    isLoading: false,
    error: null
  });
  
  // Directly integrate with transaction storage to fix connection issues
  const { savedTransactions, isLoading: storageLoading } = useTransactionStorage(user);
  
  // Keep track of connection attempts and mounted status
  const mountedRef = useRef(true);
  const reconnectAttemptedRef = useRef(false);
  const initialLoadCompletedRef = useRef(false);
  const recoveryAttemptedRef = useRef(false);
  const lastErrorRef = useRef<string | null>(null);
  
  // Add a session reconnect flag to prevent repeated attempts
  const sessionReconnectAttemptedKey = 'bank_session_reconnect_attempted';
  
  // Check if we've already tried to reconnect in this session
  const hasSessionReconnectFlag = useCallback(() => {
    try {
      return sessionStorage.getItem(sessionReconnectAttemptedKey) === 'true';
    } catch (e) {
      return false;
    }
  }, []);
  
  // Set the session reconnect flag
  const setSessionReconnectFlag = useCallback(() => {
    try {
      sessionStorage.setItem(sessionReconnectAttemptedKey, 'true');
    } catch (e) {
      console.error("Failed to set session reconnect flag:", e);
    }
  }, []);

  // Set the user in the service whenever it changes
  useEffect(() => {
    bankConnectionService.setUser(user);
    
    // Reset the reconnect attempted flag when user changes
    if (user) {
      reconnectAttemptedRef.current = false;
      initialLoadCompletedRef.current = false;
      recoveryAttemptedRef.current = false;
    }
  }, [user]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);
  
  // Safe state setter for connection status
  const safeSetConnectionStatus = useCallback((newStatus: ConnectionStatus) => {
    if (mountedRef.current) {
      setConnectionStatus(newStatus);
      
      // Store the last error for debugging
      if (newStatus.error) {
        lastErrorRef.current = newStatus.error;
      }
    }
  }, []);
  
  // Safe state setter for transactions
  const safeSetTransactions = useCallback((txs: Transaction[]) => {
    if (mountedRef.current) {
      setTransactions(txs);
    }
  }, []);

  // Connect to bank with Plaid token
  const connectBank = useCallback(async (publicToken: string) => {
    if (!publicToken) {
      safeSetConnectionStatus({
        isConnected: false,
        isLoading: false,
        error: "No public token provided"
      });
      return;
    }

    safeSetConnectionStatus({
      isConnected: false,
      isLoading: true,
      error: null
    });

    try {
      // Use the service to connect to the bank
      const result = await bankConnectionService.connectBank(publicToken);
      
      if (result.success && result.transactions) {
        safeSetTransactions(result.transactions);
        safeSetConnectionStatus({
          isConnected: true,
          isLoading: false,
          error: null
        });
      } else {
        safeSetConnectionStatus({
          isConnected: false,
          isLoading: false,
          error: result.error || "Unknown connection error"
        });
      }
    } catch (error) {
      console.error("Bank connection error:", error);
      
      safeSetConnectionStatus({
        isConnected: false,
        isLoading: false,
        error: error instanceof Error ? error.message : "Failed to connect bank account"
      });
    }
  }, [safeSetConnectionStatus, safeSetTransactions]);

  // Function to clear saved transactions
  const clearSavedTransactions = useCallback(() => {
    safeSetTransactions([]);
  }, [safeSetTransactions]);
  
  // Function to set transactions from an external source (like Firebase)
  // This will also update the connection status if needed
  const setExternalTransactions = useCallback((externalTransactions: Transaction[]) => {
    if (!externalTransactions || externalTransactions.length === 0) return;
    
    console.log(`Setting ${externalTransactions.length} external transactions and updating connection status`);
    
    // Set the transactions
    safeSetTransactions(externalTransactions);
    
    // Update connection status if we're not already connected
    if (!connectionStatus.isConnected && !connectionStatus.isLoading) {
      safeSetConnectionStatus({
        isConnected: true,
        isLoading: false,
        error: null
      });
    }
  }, [connectionStatus.isConnected, connectionStatus.isLoading, safeSetConnectionStatus, safeSetTransactions]);
  
  // Reset connection state - useful for debugging
  const resetConnection = useCallback(() => {
    // Reset state
    safeSetConnectionStatus({
      isConnected: false,
      isLoading: false,
      error: null
    });
    safeSetTransactions([]);
    
    // Reset reconnection flags
    bankConnectionService.resetReconnectionBlocks();
    
    // Reset attempt tracking
    reconnectAttemptedRef.current = false;
    recoveryAttemptedRef.current = false;
    lastErrorRef.current = null;
    
    // Clear session reconnect flag to allow reconnection attempts again
    try {
      sessionStorage.removeItem(sessionReconnectAttemptedKey);
    } catch (e) {
      console.error("Failed to remove session reconnect flag:", e);
    }
    
    console.log("Connection state reset, you can try reconnecting now");
  }, [safeSetConnectionStatus, safeSetTransactions, sessionReconnectAttemptedKey]);

  // Disconnect from bank
  const disconnectBank = useCallback(async (options?: DisconnectionOptions) => {
    try {
      // Default options
      const defaultOptions: DisconnectionOptions = {
        clearStoredData: true,
        clearCookies: true,
        removeIframes: true,
        clearIndexedDB: true,
        preventAutoReconnect: true,
        reloadPage: false
      };
      
      // Use the service to disconnect
      const success = await bankConnectionService.disconnectBank({
        ...defaultOptions,
        ...options
      });
      
      // Only update state if not reloading the page
      if (!options?.reloadPage) {
        safeSetTransactions([]);
        safeSetConnectionStatus({
          isConnected: false,
          isLoading: false,
          error: null
        });
      }
      
      return success;
    } catch (error) {
      console.error("Error during disconnect:", error);
      
      safeSetConnectionStatus({
        isConnected: false,
        isLoading: false,
        error: error instanceof Error ? error.message : "Failed to disconnect bank account"
      });
      
      return false;
    }
  }, [safeSetConnectionStatus, safeSetTransactions]);

  // Emergency disconnect - complete cleanup and reload page
  const emergencyDisconnect = useCallback(async () => {
    return bankConnectionService.emergencyDisconnect();
  }, []);

  // Create debug panel component
  const ConnectionDebugPanel = useCallback(() => {
    return React.createElement(ConnectionDiagnostic, {
      userId: user?.uid || null,
      onReset: resetConnection
    });
  }, [user, resetConnection]);

  // Check if reconnection is blocked
  const isReconnectBlocked = bankConnectionService.isReconnectBlocked();

  // Recovery attempt effect - runs after the initial attempt if we're not connected
  useEffect(() => {
    if (!user || 
        connectionStatus.isConnected || 
        connectionStatus.isLoading || 
        !initialLoadCompletedRef.current ||
        recoveryAttemptedRef.current || 
        !mountedRef.current ||
        hasSessionReconnectFlag()) {  // Added check for session flag
      return;
    }
    
    // If reconnection is blocked, don't attempt recovery
    if (isReconnectBlocked) {
      console.log("Recovery attempt skipped due to reconnect block");
      return;
    }

    // If the initial auto-reconnect failed, but the persisted state indicates we should be connected,
    // try one more time after a delay
    if (bankConnectionService.shouldAttemptReconnect()) {
      recoveryAttemptedRef.current = true;
      setSessionReconnectFlag();  // Set the session flag
      
      const delayMs = 3000; // 3 second delay 
      
      console.log(`Initial reconnect attempt failed, scheduling recovery attempt in ${delayMs}ms`);
      
      const timeoutId = setTimeout(async () => {
        try {
          console.log("Executing recovery reconnect attempt");
          
          safeSetConnectionStatus({
            isConnected: false,
            isLoading: true,
            error: null
          });
          
          const result = await bankConnectionService.autoReconnect();
          
          if (result.success && result.transactions) {
            safeSetTransactions(result.transactions);
            safeSetConnectionStatus({
              isConnected: true,
              isLoading: false,
              error: null
            });
            console.log("Successfully recovered bank connection");
          } else {
            safeSetConnectionStatus({
              isConnected: false,
              isLoading: false,
              error: null
            });
          }
        } catch (error) {
          console.error("Error in recovery reconnect:", error);
          
          safeSetConnectionStatus({
            isConnected: false,
            isLoading: false,
            error: null
          });
        }
      }, delayMs);
      
      return () => clearTimeout(timeoutId);
    }
  }, [user, connectionStatus.isConnected, connectionStatus.isLoading, safeSetConnectionStatus, safeSetTransactions, isReconnectBlocked, hasSessionReconnectFlag]);

  // Auto-reconnect on initial load
  useEffect(() => {
    // Skip if no user, already connected, already loading, or already attempted
    if (!user || 
        connectionStatus.isConnected || 
        connectionStatus.isLoading || 
        reconnectAttemptedRef.current || 
        !mountedRef.current ||
        hasSessionReconnectFlag()) {  // Added check for session flag
      return;
    }
    
    // Skip if reconnection is blocked
    if (isReconnectBlocked) {
      console.log("Auto-reconnect skipped due to reconnect block");
      reconnectAttemptedRef.current = true;
      initialLoadCompletedRef.current = true;
      
      // Make sure UI shows disconnected state
      safeSetConnectionStatus({
        isConnected: false,
        isLoading: false,
        error: null
      });
      
      // Make sure we're not showing any transactions
      safeSetTransactions([]);
      return;
    }
    
    // Check if we should attempt to reconnect
    const shouldReconnect = bankConnectionService.shouldAttemptReconnect();
    console.log("Auto-reconnect check on page load:", { shouldReconnect });
    
    // Mark that we've attempted to reconnect to prevent multiple attempts
    reconnectAttemptedRef.current = true;
    setSessionReconnectFlag();  // Set the session flag
    
    if (!shouldReconnect) {
      initialLoadCompletedRef.current = true;
      
      // If reconnection is explicitly blocked, make sure the UI reflects disconnected state
      const isReconnectBlocked = bankConnectionService.isReconnectBlocked();
      
      if (isReconnectBlocked) {
        console.log("Reconnection is blocked, ensuring UI shows disconnected state");
        safeSetConnectionStatus({
          isConnected: false,
          isLoading: false,
          error: null
        });
        
        // Make sure we're not showing any transactions
        safeSetTransactions([]);
      }
      
      return;
    }
    
    // Attempt to reconnect with a small delay to allow page to fully load
    setTimeout(async () => {
      try {
        if (!mountedRef.current) return;
        
        console.log("Starting auto-reconnect attempt");
        safeSetConnectionStatus({
          isConnected: false,
          isLoading: true,
          error: null
        });
        
        const result = await bankConnectionService.autoReconnect();
        
        if (!mountedRef.current) return;
        
        if (result.success && result.transactions) {
          safeSetTransactions(result.transactions);
          safeSetConnectionStatus({
            isConnected: true,
            isLoading: false,
            error: null
          });
          console.log("Successfully auto-reconnected to bank");
        } else {
          safeSetConnectionStatus({
            isConnected: false,
            isLoading: false,
            error: null // Don't show error for failed auto-reconnect
          });
          console.log("Auto-reconnect failed:", result.error || "No error provided");
        }
      } catch (error) {
        console.error("Error in auto-reconnect:", error);
        
        if (!mountedRef.current) return;
        
        safeSetConnectionStatus({
          isConnected: false,
          isLoading: false,
          error: null // Don't show error for failed auto-reconnect
        });
      } finally {
        initialLoadCompletedRef.current = true;
      }
    }, 500); // Small delay to ensure everything is loaded
    
  }, [user, connectionStatus.isConnected, connectionStatus.isLoading, safeSetConnectionStatus, safeSetTransactions, isReconnectBlocked, hasSessionReconnectFlag]);
  
  // Effect to update connection status when transactions are loaded from other sources
  // This ensures the connection status reflects when transactions exist even if not from Plaid
  useEffect(() => {
    // Check if reconnect is blocked first
    if (bankConnectionService.isReconnectBlocked()) {
      console.log("Connection status update blocked - reconnection is blocked");
      return;
    }
    
    // Only proceed if we have transactions but not connected
    if (transactions.length > 0 && !connectionStatus.isConnected && !connectionStatus.isLoading && user) {
      console.log(`Found ${transactions.length} loaded transactions, updating connection status`);
      // Only update if we're not currently loading and we have transactions
      safeSetConnectionStatus({
        isConnected: true,
        isLoading: false,
        error: null
      });
    }
  }, [transactions.length, connectionStatus.isConnected, connectionStatus.isLoading, user, safeSetConnectionStatus]);

  // Direct integration with transaction storage
  useEffect(() => {
    // Check if reconnect is blocked first
    if (bankConnectionService.isReconnectBlocked()) {
      console.log("Direct integration blocked - reconnection is blocked");
      return;
    }

    if (savedTransactions && savedTransactions.length > 0 && 
        transactions.length === 0 && 
        !connectionStatus.isConnected && 
        !connectionStatus.isLoading) {
      console.log("🔁 Direct integration: Setting saved transactions and updating connection status");
      safeSetTransactions(savedTransactions);
      safeSetConnectionStatus({
        isConnected: true,
        isLoading: false,
        error: null
      });
    }
  }, [savedTransactions, transactions.length, connectionStatus.isConnected, 
      connectionStatus.isLoading, safeSetTransactions, safeSetConnectionStatus]);
      
  // Update loading state when storage is loading
  useEffect(() => {
    // Skip if reconnection is blocked
    if (bankConnectionService.isReconnectBlocked()) {
      console.log("Storage loading update blocked - reconnection is blocked");
      return;
    }
    
    if (storageLoading && !connectionStatus.isLoading && !connectionStatus.isConnected) {
      safeSetConnectionStatus({
        isConnected: false,
        isLoading: true,
        error: null
      });
    }
  }, [storageLoading, connectionStatus.isLoading, connectionStatus.isConnected, safeSetConnectionStatus]);

  // Check if the user is currently connected to their bank
  // We determine this based on whether we have a token
  // and whether we have transactions
  let isConnected = connectionStatus.isConnected;
  const isConnectedWithTxns = isConnected && transactions.length > 0;
  
  // If we have a blocked reconnect, we're not connected regardless of other states
  if (bankConnectionService.isReconnectBlocked()) {
    isConnected = false;
  }

  return {
    connectionStatus,
    transactions,
    connectBank,
    disconnectBank,
    emergencyDisconnect,
    clearSavedTransactions,
    resetConnection,
    ConnectionDebugPanel,
    setExternalTransactions
  };
}