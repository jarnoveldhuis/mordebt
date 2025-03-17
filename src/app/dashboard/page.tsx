"use client";

import { useEffect, useCallback, useState, useMemo } from "react";
import { useAuth } from "@/shared/hooks/useAuth";
import { LoadingSpinner } from "@/shared/components/ui/LoadingSpinner";
import { ErrorAlert } from "@/shared/components/ui/ErrorAlert";
import { useTransactionStorage } from "@/features/analysis/useTransactionStorage";
import { useTransactionAnalysis } from "@/features/analysis/useTransactionAnalysis";
import { Transaction } from "@/shared/types/transactions";
import { config } from "@/config";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { DashboardContent } from "@/components/dashboard/DashboardContent";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { PlaidConnectionSection } from "@/features/banking/PlaidConnectionSection";
import { TransactionList } from "@/features/analysis/TransactionList";
import { ConsolidatedImpactView } from "@/features/analysis/ConsolidatedImpactView";
import { CategoryExperimentView } from "@/features/analysis/CategoryExperimentView";
import { PracticeDebtTable } from "@/features/analysis/PracticeDebtTable";
import { deleteAllUserTransactions, userHasData, loadUserTransactions } from "@/features/analysis/directFirebaseLoader";

// Import the sample data hook
import { useSampleData } from '@/features/debug/useSampleData';

// Determine if we're in development/sandbox mode
const isSandboxMode = process.env.NODE_ENV === 'development' || config.plaid.isSandbox;

// Helper function to get color class for debt values
function getColorClass(value: number): string {
  if (value < 0) return "text-green-600";
  if (value === 0) return "text-blue-600";
  if (value <= 10) return "text-yellow-600";
  if (value <= 20) return "text-orange-600";
  if (value <= 50) return "text-red-600";
  return "text-red-700";
}

export default function Dashboard() {
  // Track direct Firebase loading state
  const [directLoadAttempted, setDirectLoadAttempted] = useState(false);
  const [isLoadingDirect, setIsLoadingDirect] = useState(false);
  const [debugConnectionStatus, setDebugConnectionStatus] = useState(false);
  const [activeView, setActiveView] = useState<string>("transactions");
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  
  // Authentication state
  const { user, loading: authLoading, logout } = useAuth();

  // Firebase storage for analyzed transactions
  const {
    savedTransactions,
    totalSocietalDebt,
    isLoading: storageLoading,
    error: storageError,
    saveTransactions,
    loadLatestTransactions,
    hasSavedData,
    resetStorage
  } = useTransactionStorage(user);

  // Transaction analysis
  const {
    analyzedData,
    analysisStatus,
    analyzeTransactions
  } = useTransactionAnalysis();

  // Track connection status independent of actual Plaid connection
  const [connectionStatus, setConnectionStatus] = useState({
    isConnected: false,
    isLoading: false,
    error: null as string | null
  });

  // Consolidate transactions for display
  const displayTransactions = analyzedData?.transactions || savedTransactions || [];
  
  // Calculate practice donations - this would be used for the PracticeDebtTable
  const practiceDonations = useMemo(() => {
    if (!displayTransactions || displayTransactions.length === 0) {
      return {};
    }

    const donations: Record<string, { charity: { name: string; url: string } | null; amount: number }> = {};

    displayTransactions.forEach(tx => {
      // Process unethical practices
      (tx.unethicalPractices || []).forEach(practice => {
        if (!donations[practice]) {
          donations[practice] = {
            charity: tx.charities?.[practice] || null,
            amount: 0
          };
        }
        
        // Add the debt amount for this practice
        const weight = tx.practiceWeights?.[practice] || 0;
        donations[practice].amount += tx.amount * (weight / 100);
      });

      // Process ethical practices (negative debt)
      (tx.ethicalPractices || []).forEach(practice => {
        if (!donations[practice]) {
          donations[practice] = {
            charity: tx.charities?.[practice] || null,
            amount: 0
          };
        }
        
        // Subtract the credit amount for this practice
        const weight = tx.practiceWeights?.[practice] || 0;
        donations[practice].amount -= tx.amount * (weight / 100);
      });
    });

    return donations;
  }, [displayTransactions]);

  // Try to load data directly from Firebase if hook-based loading fails
  const loadDirectFromFirebase = useCallback(async () => {
    if (!user || isLoadingDirect || directLoadAttempted) return;
    
    console.log(`🚨 Attempting direct Firebase load for user: ${user.uid}`);
    setIsLoadingDirect(true);
    setDirectLoadAttempted(true);
    
    try {
      // First check if the user has any data at all
      const hasData = await userHasData(user.uid);
      
      if (!hasData) {
        console.log("🚨 Direct Firebase check: User has no data stored");
        setIsLoadingDirect(false);
        return;
      }
      
      // Load the data directly
      const result = await loadUserTransactions(user.uid);
      
      if (result.error) {
        console.error("🚨 Direct Firebase load error:", result.error);
        setIsLoadingDirect(false);
        return;
      }
      
      if (!result.transactions || result.transactions.length === 0) {
        console.log("🚨 Direct Firebase load: No transactions found");
        setIsLoadingDirect(false);
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
      
      setIsLoadingDirect(false);
    } catch (error) {
      console.error("🚨 Error in direct Firebase loading:", error);
      setIsLoadingDirect(false);
    }
  }, [user, analyzeTransactions, directLoadAttempted, isLoadingDirect]);

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

  // Handle successful data load from Firebase
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

  // Get the sample data generation functions
  const { generateSampleTransactions, calculateSampleDebt } = useSampleData();

  // Handle loading sample data from debug panel
  const handleLoadSampleData = useCallback((sampleTransactions?: Transaction[]) => {
    // If no transactions are provided, generate them
    const transactions = sampleTransactions || generateSampleTransactions();
    
    if (!transactions || transactions.length === 0) {
      console.error("No sample transactions available");
      return;
    }
    
    console.log(`Loading ${transactions.length} sample transactions directly`);
    
    // Skip the bank connection process and go straight to analysis
    analyzeTransactions(transactions);
    
    // Update connection status
    setConnectionStatus({
      isConnected: true,
      isLoading: false,
      error: null
    });
  }, [analyzeTransactions, generateSampleTransactions]);

  // Handle Plaid success callback
  const handlePlaidSuccess = useCallback((publicToken: string | null) => {
    // If no token is provided, we're using sample data
    if (!publicToken) {
      console.log("🧪 Using sample data instead of Plaid");
      handleLoadSampleData();
      return;
    }
    
    console.log("🏦 Bank Connection Successful");
    setConnectionStatus({
      isConnected: true,
      isLoading: false,
      error: null
    });
    
    // In a real implementation, this would exchange the token and fetch transactions
    // For now, we'll simulate success
    setDebugConnectionStatus(true);
    
    // A real implementation would have code like:
    // 1. Exchange public token for access token
    // 2. Use access token to fetch transactions
    // 3. Process and analyze transactions
    
    // For demo purposes, we'll just load sample data
    if (isSandboxMode) {
      handleLoadSampleData();
    }
  }, [handleLoadSampleData]);

  // Reset all user transactions
  const handleResetTransactions = useCallback(async () => {
    if (!user) return Promise.resolve();
    
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

  // Handle disconnecting bank
  const handleDisconnectBank = useCallback(() => {
    setConnectionStatus({
      isConnected: false,
      isLoading: false,
      error: null
    });
    
    setDebugConnectionStatus(false);
    
    // Also clear analyzed data if needed
    resetStorage();
  }, [resetStorage]);

  // Determine if we have data to show
  const hasData = Boolean(analyzedData && analyzedData.transactions.length > 0);
  const isLoading = connectionStatus.isLoading || 
                    analysisStatus.status === 'loading' || 
                    storageLoading || 
                    isLoadingDirect;
  const error = connectionStatus.error || analysisStatus.error || storageError;
  const effectiveConnectionStatus = connectionStatus.isConnected || debugConnectionStatus;

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

  // Get the currently active view component
  const renderActiveView = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner message={
            connectionStatus.isLoading 
              ? "Loading transactions..." 
              : isLoadingDirect
                ? "Loading data directly from Firebase..."
                : "Analyzing your transactions..."
          } />
        </div>
      );
    }

    if (!hasData) {
      return (
        <div className="flex flex-col items-center justify-center h-64 p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-2">No Transactions Found</h2>
          <p className="text-gray-600 mb-4 text-center">
            {effectiveConnectionStatus 
              ? "We couldn't find any transactions in your connected account." 
              : "Connect your bank or use the debug tools to load transactions."}
          </p>
          {effectiveConnectionStatus && (
            <button
              onClick={handleDisconnectBank}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded"
            >
              Try Connecting Again
            </button>
          )}
        </div>
      );
    }

    // Render appropriate view based on active tab
    switch (activeView) {
      case "impact":
        return (
          <ConsolidatedImpactView 
            transactions={displayTransactions}
            totalSocietalDebt={totalSocietalDebt || analyzedData?.totalSocietalDebt || 0}
          />
        );
      case "categories":
        return (
          <CategoryExperimentView 
            transactions={displayTransactions}
            totalSocietalDebt={totalSocietalDebt || analyzedData?.totalSocietalDebt || 0}
          />
        );
      case "practices":
        return (
          <PracticeDebtTable 
            practiceDonations={practiceDonations}
            transactions={displayTransactions}
            totalSocietalDebt={totalSocietalDebt || analyzedData?.totalSocietalDebt || 0}
          />
        );
      case "transactions":
      default:
        return (
          <TransactionList 
            transactions={displayTransactions}
            getColorClass={getColorClass}
          />
        );
    }
  };

  // Render the dashboard
  return (
    <DashboardLayout 
      user={user}
      onLogout={logout}
      onDisconnectBank={handleDisconnectBank}
      isBankConnected={effectiveConnectionStatus}
    >
      {/* Error display */}
      {error && <ErrorAlert message={error} />}

      {/* Main content area */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <DashboardSidebar 
          user={user}
          impactScore={75}
          activeView={activeView}
          onViewChange={setActiveView}
          totalSocietalDebt={totalSocietalDebt || analyzedData?.totalSocietalDebt || 0}
          offsetsThisMonth={37.5}
          hasTransactions={hasData}
        />

        {/* Main content */}
        <div className="lg:col-span-3 space-y-6">
          {/* Bank Connection Section - Only shown when not connected */}
          {!effectiveConnectionStatus && (
            <div className="bg-white rounded-xl shadow-md p-6">
              <h2 className="text-lg font-semibold text-blue-800 mb-2">
                Connect Your Bank
              </h2>
              <p className="text-sm text-blue-700 mb-4">
                Connect your bank account to analyze your transactions and calculate your societal debt.
              </p>
              <PlaidConnectionSection 
                onSuccess={handlePlaidSuccess} 
                isConnected={effectiveConnectionStatus}
              />
            </div>
          )}

          {/* Main view content */}
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            {renderActiveView()}
          </div>
          
          {/* Debug panel toggle - only in dev/sandbox mode */}
          {isSandboxMode && (
            <div className="mt-4 text-center">
              <button 
                onClick={() => setShowDebugPanel(!showDebugPanel)}
                className="text-xs text-blue-600 underline"
              >
                {showDebugPanel ? "Hide Debug Panel" : "Show Debug Panel"}
              </button>
              
              {/* Debug panel content */}
              {showDebugPanel && (
                <div className="mt-4 p-4 border border-gray-300 rounded bg-gray-50">
                  <h3 className="font-bold text-gray-700 mb-2">Sandbox Testing Tools</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                    <button
                      onClick={() => handleLoadSampleData()}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded font-medium text-sm"
                    >
                      Load Sample Data
                    </button>
                    
                    <button
                      onClick={handleResetTransactions}
                      className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded font-medium text-sm"
                    >
                      Reset All Data
                    </button>
                  </div>
                  
                  <div className="mt-3 text-xs text-gray-600">
                    <div>User ID: {user?.uid || 'Not logged in'}</div>
                    <p className="mt-1 text-yellow-700">
                      <strong>Note:</strong> These options are only visible in development/sandbox mode.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}