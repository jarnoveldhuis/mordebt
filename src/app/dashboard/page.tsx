// src/app/dashboard/page.tsx - Updated with bank disconnect functionality
"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { useAuth } from "@/shared/hooks/useAuth";
import { Header } from "@/shared/components/Header";
import { PlaidConnectionSection } from "@/app/api/banking/PlaidConnectionSection";
import { LoadingSpinner } from "@/shared/components/ui/LoadingSpinner";
import { ErrorAlert } from "@/shared/components/ui/ErrorAlert";
import { TabView } from "@/features/analysis/TabView";
import { config } from "@/config/index";
import { useTransactionStorage } from "@/features/analysis/useTransactionStorage";
import { useTransactionAnalysis } from "@/features/analysis/useTransactionAnalysis";
import { useBankConnection } from "@/features/banking/useBankConnection";
import { FirebaseVerifier } from "@/features/debug/FirebaseVerifier";
import { SandboxTestingPanel } from "@/features/debug/SandboxTestingPanel";
import { loadUserTransactions, userHasData, deleteAllUserTransactions } from "@/features/analysis/directFirebaseLoader";
import { Transaction } from "@/shared/types/transactions";

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
    setTransactions: setBankTransactions 
  } = useBankConnection();

  // Transaction analysis
  const {
    analyzedData,
    analysisStatus,
    analyzeTransactions
  } = useTransactionAnalysis();

  // Determine if we're in development/sandbox mode
  const isSandboxMode = process.env.NODE_ENV === 'development' || config.plaid.isSandbox;
  
  // Auto-enable Firebase debugging in development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      enableDebug();
    }
  }, [enableDebug]);

  // Handle loading sample data directly
  const handleLoadSampleData = useCallback((sampleTransactions: Transaction[]) => {
    if (!sampleTransactions || sampleTransactions.length === 0) {
      console.error("No sample transactions provided");
      return;
    }
    
    console.log(`Loading ${sampleTransactions.length} sample transactions directly`);
    
    // Mark transactions with analysis placeholders
    const initializedTransactions = sampleTransactions.map(tx => ({
      ...tx,
      societalDebt: 0,
      unethicalPractices: tx.unethicalPractices || [],
      ethicalPractices: tx.ethicalPractices || [],
      information: tx.information || {},
      analyzed: false
    }));
    
    // Set the transactions directly
    setBankTransactions(initializedTransactions);
    
    // Analyze the transactions immediately
    analyzeTransactions(initializedTransactions);
  }, [setBankTransactions, analyzeTransactions]);

  // Handler for disconnecting bank account
  const handleDisconnectBank = useCallback(() => {
    // Reset UI state
    resetStorage();
    
    // Disconnect the bank account
    disconnectBank();
    
    console.log("Bank account disconnected");
  }, [resetStorage, disconnectBank]);

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

  // Handle Plaid success callback for real bank connection
  const handlePlaidSuccess = useCallback((publicToken: string | null) => {
    console.log("🏦 Real Bank Connection Successful");
    connectBank(publicToken);
  }, [connectBank]);

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

  // Handle enabling debug mode
  const handleEnableDebug = useCallback(() => {
    enableDebug();
    alert("Firebase debugging enabled - check console for detailed logs");
  }, [enableDebug]);

  // Handle disabling debug mode
  const handleDisableDebug = useCallback(() => {
    disableDebug();
    alert("Firebase debugging disabled");
  }, [disableDebug]);

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
        {/* Header with user info, bank disconnect and logout */}
        <Header 
          user={user} 
          onLogout={handleLogout} 
          onDisconnectBank={handleDisconnectBank}
          isBankConnected={connectionStatus.isConnected}
        />

        {/* Error display */}
        {error && <ErrorAlert message={error} />}

        {/* Bank Connection Section - Always visible */}
        <div className="my-6 p-4 border rounded-lg bg-blue-50 text-center">
          <h2 className="text-lg font-semibold text-blue-800 mb-2">
            {connectionStatus.isConnected ? "Bank Connection" : "Connect Your Bank"}
          </h2>
          <p className="text-sm text-blue-700 mb-4">
            {connectionStatus.isConnected 
              ? "You can disconnect and reconnect to a different bank account."
              : "Connect your bank account to analyze your transactions and calculate your societal debt."}
          </p>
          <PlaidConnectionSection 
            onSuccess={handlePlaidSuccess}
            isConnected={connectionStatus.isConnected}
          />
        </div>

        {/* Loading states */}
        {isLoading && (
          <LoadingSpinner 
            message={
              connectionStatus.isLoading 
                ? "Loading transactions..." 
                : isLoadingDirectRef.current
                  ? "Loading data directly from Firebase..."
                  : "Analyzing your transactions..."
            } 
          />
        )}

        {/* Main content - show when we have analyzed data */}
        {hasData && analyzedData && (
          <TabView
            transactions={analyzedData.transactions}
            totalSocietalDebt={analyzedData.totalSocietalDebt}
            getColorClass={getColorClass}
          />
        )}
        
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
                  onClick={handleEnableDebug}
                  className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm"
                >
                  Enable Firebase Debug
                </button>
                <button 
                  onClick={handleDisableDebug}
                  className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm"
                >
                  Disable Firebase Debug
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
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}