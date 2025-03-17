// src/app/dashboard/page.tsx
"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { useAuth } from "@/shared/hooks/useAuth";
import { Header } from "@/shared/components/Header";
import { LoadingSpinner } from "@/shared/components/ui/LoadingSpinner";
import { ErrorAlert } from "@/shared/components/ui/ErrorAlert";
import { TabView } from "@/features/analysis/TabView";
import { useTransactionStorage } from "@/features/analysis/useTransactionStorage";
import { useTransactionAnalysis } from "@/features/analysis/useTransactionAnalysis";
import { useBankConnection } from "@/features/banking/useBankConnection";
import { FirebaseVerifier } from "@/features/debug/FirebaseVerifier";
import { SandboxTestingPanel } from "@/features/debug/SandboxTestingPanel";
import { loadUserTransactions, userHasData, deleteAllUserTransactions } from "@/features/analysis/directFirebaseLoader";
import { Transaction } from "@/shared/types/transactions";
import { PlaidConnectionSection } from "@/features/banking/PlaidConnectionSection";
import { config } from "@/config";

// Determine if we're in development/sandbox mode
const isSandboxMode = process.env.NODE_ENV === 'development' || config.plaid.isSandbox;

// Helper function to get color class for debt values
function getColorClass(value: number): string {
  if (value < 0) return "text-green-500";
  if (value === 0) return "text-blue-500";
  if (value <= 10) return "text-yellow-500";
  if (value <= 20) return "text-orange-500";
  if (value <= 50) return "text-red-500";
  return "text-red-700";
}

export default function Dashboard() {
  // Track previous user and component state
  const previousUserIdRef = useRef<string | null>(null);
  const isLoadingDirectRef = useRef(false);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [autoReconnectStatus, setAutoReconnectStatus] = useState<string | null>(null);
  
  // Track direct Firebase loading state
  const [directLoadAttempted, setDirectLoadAttempted] = useState(false);
  
  // Authentication state
  const { user, loading: authLoading, logout } = useAuth();

  // Firebase storage for analyzed transactions
  const {
    savedTransactions,
    isLoading: storageLoading,
    error: storageError,
    saveTransactions,
    loadLatestTransactions,
    hasSavedData,
    resetStorage,
    enableDebug,
    disableDebug
  } = useTransactionStorage(user);

  // Bank connection and transactions
  const { 
    connectionStatus,
    transactions: bankTransactions,
    connectBank,
    disconnectBank,
    autoReconnectBank
  } = useBankConnection(user);

  // Transaction analysis
  const {
    analyzedData,
    analysisStatus,
    analyzeTransactions
  } = useTransactionAnalysis();

  // State for debug mode fake connection status
  const [debugConnectionStatus, setDebugConnectionStatus] = useState(false);
  
  // Merge real and debug connection statuses
  const effectiveConnectionStatus = {
    ...connectionStatus,
    isConnected: connectionStatus.isConnected || debugConnectionStatus
  };
  
  // Auto-enable Firebase debugging in development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      enableDebug();
    }
  }, [enableDebug]);

  // Try to auto-reconnect bank when user is authenticated
  useEffect(() => {
    if (user && !connectionStatus.isConnected && !connectionStatus.isLoading) {
      // Reset auto-reconnect status
      setAutoReconnectStatus("Checking previous bank connection...");
      
      // Attempt auto-reconnect
      autoReconnectBank()
        .then(success => {
          if (success) {
            // Show success message briefly then clear it
            setAutoReconnectStatus("Bank automatically reconnected");
            console.log("🏦 Successfully auto-reconnected bank");
            
            // Clear the status message after 3 seconds to remove the spinner
            setTimeout(() => {
              setAutoReconnectStatus(null);
            }, 3000);
          } else {
            setAutoReconnectStatus(null);
            console.log("🏦 No previous bank connection found");
          }
        })
        .catch(err => {
          console.error("Error in auto-reconnect:", err);
          setAutoReconnectStatus("Auto-reconnect failed");
          
          // Clear error message after 5 seconds
          setTimeout(() => {
            setAutoReconnectStatus(null);
          }, 5000);
        });
    }
  }, [user, connectionStatus.isConnected, connectionStatus.isLoading, autoReconnectBank]);

  // Detect user changes using a ref instead of state
  useEffect(() => {
    const currentUserId = user?.uid || null;
    const previousUserId = previousUserIdRef.current;
    
    // Only run on real changes, not initial render
    if (previousUserId !== undefined && currentUserId !== previousUserId) {
      console.log(`User change detected: ${previousUserId} -> ${currentUserId}`);
      
      // Log out transition
      if (!currentUserId && previousUserId) {
        console.log("User logged out");
        resetStorage();
        disconnectBank(); // Also disconnect bank account on logout
        // The useAuth hook will handle redirection
      }
      
      // Log in transition
      if (currentUserId && !previousUserId) {
        console.log("User logged in - will load data shortly");
        setDirectLoadAttempted(false); // Reset direct load flag on login
      }
      
      // User switch (different user logged in)
      if (currentUserId && previousUserId && currentUserId !== previousUserId) {
        console.log("Different user logged in");
        resetStorage();
        disconnectBank(); // Also disconnect bank account on user switch
        setDirectLoadAttempted(false); // Reset direct load flag on user switch
      }
    }
    
    // Update the previous user ref
    previousUserIdRef.current = currentUserId;
  }, [user, resetStorage, disconnectBank]);

  // Try to load data directly from Firebase if hook-based loading fails
  const loadDirectFromFirebase = useCallback(async () => {
    if (!user || isLoadingDirectRef.current || directLoadAttempted) return;
    
    console.log(`🚨 Attempting direct Firebase load for user: ${user.uid}`);
    isLoadingDirectRef.current = true;
    setDirectLoadAttempted(true);
    
    try {
      // First check if the user has any data at all
      const hasData = await userHasData(user.uid);
      
      if (!hasData) {
        console.log("🚨 Direct Firebase check: User has no data stored");
        isLoadingDirectRef.current = false;
        return;
      }
      
      // Load the data directly
      const result = await loadUserTransactions(user.uid);
      
      if (result.error) {
        console.error("🚨 Direct Firebase load error:", result.error);
        isLoadingDirectRef.current = false;
        return;
      }
      
      if (!result.transactions || result.transactions.length === 0) {
        console.log("🚨 Direct Firebase load: No transactions found");
        isLoadingDirectRef.current = false;
        return;
      }
      
      console.log(`🚨 Direct Firebase load: Found ${result.transactions.length} transactions`);
      
      // Mark all transactions as analyzed
      const markedTransactions = result.transactions.map(tx => ({
        ...tx,
        analyzed: true
      }));
      
      // Analyze the directly loaded transactions
      analyzeTransactions(markedTransactions);
      
      isLoadingDirectRef.current = false;
    } catch (error) {
      console.error("🚨 Error in direct Firebase loading:", error);
      isLoadingDirectRef.current = false;
    }
  }, [user, analyzeTransactions, directLoadAttempted]);

  // Effect to try direct loading if hook loading fails
  useEffect(() => {
    if (user && 
        !savedTransactions && 
        !storageLoading && 
        !directLoadAttempted) {
      // If normal loading has completed but found no data, try direct load
      console.log("🚀 Normal loading finished with no data, trying direct load");
      loadDirectFromFirebase();
    }
  }, [user, savedTransactions, storageLoading, loadDirectFromFirebase, directLoadAttempted]);

  // Handle successful data load from Firebase (via hook or direct)
  useEffect(() => {
    if (savedTransactions && savedTransactions.length > 0 && user) {
      console.log(`📊 Using ${savedTransactions.length} saved transactions from hook`);
      
      // Mark all transactions as analyzed
      const markedTransactions = savedTransactions.map(tx => ({
        ...tx,
        analyzed: true
      }));
      
      analyzeTransactions(markedTransactions);
    }
  }, [savedTransactions, analyzeTransactions, user]);

  // Analyze new bank transactions when they arrive
  useEffect(() => {
    if (bankTransactions.length > 0 && 
        !analyzedData && 
        analysisStatus.status === 'idle' &&
        user) {
      console.log(`🧮 Analyzing ${bankTransactions.length} new bank transactions`);
      analyzeTransactions(bankTransactions);
    }
  }, [bankTransactions, analyzedData, analysisStatus, analyzeTransactions, user]);

  // Save analyzed data to Firebase
  useEffect(() => {
    // Only save if we have user, valid data, and haven't already saved this session
    if (user && 
        analyzedData && 
        analyzedData.transactions.length > 0 && 
        analysisStatus.status === 'success' &&
        !hasSavedData) {
      
      // Add a small delay to avoid race conditions with component unmounting
      const saveTimeout = setTimeout(() => {
        console.log(`💾 Saving ${analyzedData.transactions.length} analyzed transactions to Firebase`);
        saveTransactions(
          analyzedData.transactions, 
          analyzedData.totalSocietalDebt
        ).catch(err => console.error("Failed to save to Firebase:", err));
      }, 500);
      
      return () => clearTimeout(saveTimeout);
    }
  }, [user, analyzedData, analysisStatus, saveTransactions, hasSavedData]);

  // Handle Plaid success callback
  const handlePlaidSuccess = useCallback((publicToken: string) => {
    if (!publicToken) {
      console.warn("Empty public token received");
      return;
    }
    
    console.log("🏦 Bank Connection Successful");
    connectBank(publicToken);
  }, [connectBank]);

  // Handle loading sample data from debug panel
  const handleLoadSampleData = useCallback((sampleTransactions: Transaction[]) => {
    if (!sampleTransactions || sampleTransactions.length === 0) {
      console.error("No sample transactions provided");
      return;
    }
    
    console.log(`Loading ${sampleTransactions.length} sample transactions directly`);
    
    // Skip the bank connection process and go straight to analysis
    analyzeTransactions(sampleTransactions);
  }, [analyzeTransactions]);

  // Reset all user transactions
  const handleResetTransactions = useCallback(async () => {
    if (!user) return;
    
    try {
      // First reset the local state
      resetStorage();
      
      // Then delete from Firebase
      console.log(`Attempting to delete all transactions for user: ${user.uid}`);
      await deleteAllUserTransactions(user.uid);
      
      console.log("🗑️ All user transactions deleted");
      return Promise.resolve();
    } catch (error) {
      console.error("Failed to reset transactions:", error);
      throw error;
    }
  }, [user, resetStorage]);

  // Handle logout with cleanup
  const handleLogout = useCallback(() => {
    console.log("User initiated logout");
    resetStorage();
    disconnectBank(); // Also disconnect bank on logout
    logout();
  }, [resetStorage, disconnectBank, logout]);
  
  // Handle disconnecting bank with transaction cleanup
  const handleDisconnectBank = useCallback(() => {
    // Disconnect bank
    disconnectBank();
    
    // Also clear analyzed data
    resetStorage();
  }, [disconnectBank, resetStorage]);

  // Force direct load from Firebase
  const handleForceDirectLoad = useCallback(() => {
    if (user) {
      console.log("🔄 Manual direct load triggered");
      setDirectLoadAttempted(false); // Reset flag to allow reload
      loadDirectFromFirebase();
    }
  }, [user, loadDirectFromFirebase]);

  // Handle loading states
  if (authLoading) {
    return (
      <div className="text-center mt-10">
        <LoadingSpinner message="Checking authentication..." />
      </div>
    );
  }

  // Redirect if no user is found (handled by useAuth hook)
  if (!user) {
    return <div className="text-center mt-10">Redirecting to login...</div>;
  }

  // Determine if we have data to show
  const hasData = Boolean(analyzedData && analyzedData.transactions.length > 0);
  const isLoading = connectionStatus.isLoading || 
                    analysisStatus.status === 'loading' || 
                    storageLoading || 
                    isLoadingDirectRef.current;
  const error = connectionStatus.error || analysisStatus.error || storageError;
  
  // Main render
  return (
    <div className="min-h-screen bg-gray-100 flex justify-center">
      <div className="bg-white shadow-lg rounded-lg p-4 sm:p-8 max-w-2xl w-full mt-4 sm:mt-8">
        {/* Header with user dropdown menu for account actions */}
        <Header 
          user={user} 
          onLogout={handleLogout} 
          onDisconnectBank={handleDisconnectBank}
          isBankConnected={effectiveConnectionStatus.isConnected}
        />

        {/* Error display */}
        {error && <ErrorAlert message={error} />}

        {/* Auto-reconnect status message */}
        {autoReconnectStatus && (
          <div className="mb-4 bg-blue-50 border border-blue-200 text-blue-700 px-4 py-2 rounded flex items-center transition-opacity duration-300">
            {autoReconnectStatus.includes("Checking") || autoReconnectStatus.includes("reconnecting") ? (
              <div className="w-4 h-4 mr-2 border-t-2 border-r-2 border-blue-700 rounded-full animate-spin"></div>
            ) : autoReconnectStatus.includes("successful") || autoReconnectStatus.includes("reconnected") ? (
              <svg className="w-4 h-4 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
            ) : (
              <svg className="w-4 h-4 mr-2 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            )}
            {autoReconnectStatus}
          </div>
        )}

        {/* Bank Connection Section - Only shown when not connected */}
        {!effectiveConnectionStatus.isConnected && (
          <div className="my-6 p-4 border rounded-lg bg-blue-50 text-center">
            <h2 className="text-lg font-semibold text-blue-800 mb-2">
              Connect Your Bank
            </h2>
            <p className="text-sm text-blue-700 mb-4">
              Connect your bank account to analyze your transactions and calculate your societal debt.
            </p>
            <PlaidConnectionSection 
              onSuccess={handlePlaidSuccess}
              isConnected={effectiveConnectionStatus.isConnected}
            />
          </div>
        )}

        {/* Main content area with tabs or loading indicator */}
        <div className="relative">
          {/* Show tab view if we have data (regardless of connection status) */}
          {hasData && analyzedData && (
            <TabView
              transactions={analyzedData.transactions}
              totalSocietalDebt={analyzedData.totalSocietalDebt}
              getColorClass={getColorClass}
            />
          )}
          
          {/* No data message when no transactions are available and not loading */}
          {!hasData && !isLoading && (
            <div className="bg-white rounded-lg shadow-md p-6 text-center">
              <h2 className="text-xl font-semibold text-gray-800 mb-2">No Transactions Found</h2>
              <p className="text-gray-600 mb-4">
                {effectiveConnectionStatus.isConnected 
                  ? "We couldn't find any transactions in your connected account." 
                  : "Connect your bank or use the debug tools to load transactions."}
              </p>
              {effectiveConnectionStatus.isConnected && (
                <button
                  onClick={() => disconnectBank()}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded"
                >
                  Try Connecting Again
                </button>
              )}
            </div>
          )}
          
          {/* Loading spinner - positioned within the content area */}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-80 z-10 rounded-lg">
              <LoadingSpinner 
                message={
                  connectionStatus.isLoading 
                    ? "Loading transactions..." 
                    : isLoadingDirectRef.current
                      ? "Loading data directly from Firebase..."
                      : "Analyzing your transactions..."
                } 
              />
            </div>
          )}
        </div>
        
        {/* Debug panel toggle */}
        <div className="mt-4 text-center">
          <button 
            onClick={() => setShowDebugPanel(!showDebugPanel)}
            className="text-xs text-blue-600 underline"
          >
            {showDebugPanel ? "Hide Debug Panel" : "Show Debug Panel"}
          </button>
        </div>
        
        {/* Debug panel with all debugging tools */}
        {showDebugPanel && (
          <div className="mt-4 p-4 border border-gray-300 rounded bg-gray-50">
            <h3 className="font-bold text-gray-700 mb-2">Debug Tools</h3>
            
            {/* Firebase Verifier - only in debug panel */}
            <FirebaseVerifier user={user} />
            
            {/* Data loading tools */}
            <div className="mt-4">
              <h4 className="font-semibold text-sm text-gray-700 mb-2">Data Operations</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button 
                  onClick={loadLatestTransactions}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm"
                >
                  Load via Hook
                </button>
                <button 
                  onClick={handleForceDirectLoad}
                  className="bg-purple-500 hover:bg-purple-600 text-white px-3 py-1 rounded text-sm"
                >
                  Load Directly
                </button>
              </div>
            </div>
            
            {/* Firebase debug options */}
            <div className="mt-3">
              <h4 className="font-semibold text-sm text-gray-700 mb-2">Firebase Debug</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button 
                  onClick={enableDebug}
                  className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm"
                >
                  Enable Firebase Debug
                </button>
                <button 
                  onClick={disableDebug}
                  className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm"
                >
                  Disable Firebase Debug
                </button>
              </div>
            </div>
            
            {/* Bank connection test */}
            <div className="mt-3">
              <h4 className="font-semibold text-sm text-gray-700 mb-2">Bank Connection</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button 
                  onClick={() => autoReconnectBank()}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm"
                >
                  Test Auto-Reconnect
                </button>
                <button 
                  onClick={disconnectBank}
                  className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm"
                >
                  Force Disconnect
                </button>
              </div>
            </div>
            
            {/* Sandbox testing tools - only visible in development/sandbox mode */}
            {isSandboxMode && (
              <SandboxTestingPanel 
                user={user}
                onLoadSampleData={handleLoadSampleData}
                onClearData={handleResetTransactions}
                isLoading={isLoading}
                setFakeConnectionStatus={setDebugConnectionStatus}
              />
            )}

            {/* Status information */}
            <div className="mt-3 p-2 border border-gray-200 rounded bg-white">
              <h4 className="font-semibold text-sm text-gray-700 mb-1">Status Information</h4>
              <div className="text-xs text-gray-600 grid grid-cols-2 gap-x-2 gap-y-1">
                <div>User ID:</div>
                <div className="font-mono">{user.uid}</div>
                
                <div>Email:</div>
                <div>{user.email}</div>
                
                <div>Has Saved Data:</div>
                <div>{hasSavedData ? 'Yes' : 'No'}</div>
                
                <div>Connection Status:</div>
                <div>{connectionStatus.isConnected ? 'Connected' : 'Not Connected'}</div>
                
                <div>Analysis Status:</div>
                <div>{analysisStatus.status}</div>
                
                <div>Transactions Count:</div>
                <div>{analyzedData?.transactions.length || 0}</div>
                
                <div>Auto-Reconnect Status:</div>
                <div>{autoReconnectStatus || 'Not Active'}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}