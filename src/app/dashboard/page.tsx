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
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { GroupedImpactSummary } from "@/features/analysis/GroupedImpactSummary";
import { PlaidConnectionSection } from "@/features/banking/PlaidConnectionSection";
import { TransactionList } from "@/features/analysis/TransactionList";
import { ConsolidatedImpactView } from "@/features/analysis/ConsolidatedImpactView";
import { CategoryExperimentView } from "@/features/analysis/CategoryExperimentView";
import { PracticeDebtTable } from "@/features/analysis/PracticeDebtTable";
import {
  deleteAllUserTransactions,
  userHasData,
  loadUserTransactions,
} from "@/features/analysis/directFirebaseLoader";
import { useSampleData } from "@/features/debug/useSampleData";

// Determine if we're in development/sandbox mode
const isSandboxMode =
  process.env.NODE_ENV === "development" || config.plaid.isSandbox;

// Helper function to get color class for debt values
function getColorClass(value: number): string {
  if (value < 0) return "text-green-600";
  if (value === 0) return "text-blue-600";
  if (value <= 10) return "text-yellow-600";
  if (value <= 20) return "text-orange-600";
  if (value <= 50) return "text-red-600";
  return "text-red-700";
}

// Interface for negative impact categories
interface CategoryImpact {
  name: string;
  amount: number;
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
    hasSavedData,
    resetStorage,
  } = useTransactionStorage(user);

  // Transaction analysis
  const { analyzedData, analysisStatus, analyzeTransactions } =
    useTransactionAnalysis();

  // Track connection status independent of actual Plaid connection
  const [connectionStatus, setConnectionStatus] = useState({
    isConnected: false,
    isLoading: false,
    error: null as string | null,
  });

  // Consolidate transactions for display - wrap in useMemo to avoid dependencies warning
  const displayTransactions = useMemo(() => {
    return analyzedData?.transactions || savedTransactions || [];
  }, [analyzedData?.transactions, savedTransactions]);

  // Calculate practice donations for the PracticeDebtTable
  const practiceDonations = useMemo(() => {
    if (!displayTransactions || displayTransactions.length === 0) {
      return {};
    }

    const donations: Record<
      string,
      { charity: { name: string; url: string } | null; amount: number }
    > = {};

    displayTransactions.forEach((tx) => {
      // Process unethical practices
      (tx.unethicalPractices || []).forEach((practice) => {
        if (!donations[practice]) {
          donations[practice] = {
            charity: tx.charities?.[practice] || null,
            amount: 0,
          };
        }

        // Add the debt amount for this practice
        const weight = tx.practiceWeights?.[practice] || 0;
        donations[practice].amount += tx.amount * (weight / 100);
      });

      // Process ethical practices (negative debt)
      (tx.ethicalPractices || []).forEach((practice) => {
        if (!donations[practice]) {
          donations[practice] = {
            charity: tx.charities?.[practice] || null,
            amount: 0,
          };
        }

        // Subtract the credit amount for this practice
        const weight = tx.practiceWeights?.[practice] || 0;
        donations[practice].amount -= tx.amount * (weight / 100);
      });
    });

    return donations;
  }, [displayTransactions]);

  // Calculate positive purchase amount
  const positiveAmount = useMemo(() => {
    let total = 0;

    // Iterate through all transactions
    displayTransactions.forEach((tx) => {
      // If we have practice-level details
      if (tx.ethicalPractices && tx.ethicalPractices.length > 0) {
        total += tx.amount || 0;
      }
      // Or if we have overall societal debt that's negative (positive impact)
      else if (tx.societalDebt && tx.societalDebt < 0) {
        total += tx.amount || 0;
      }
    });

    return total;
  }, [displayTransactions]);

  // Calculate negative purchase amount
  const negativeAmount = useMemo(() => {
    let total = 0;

    // Iterate through all transactions
    displayTransactions.forEach((tx) => {
      // If we have practice-level details
      if (tx.unethicalPractices && tx.unethicalPractices.length > 0) {
        total += tx.amount || 0;
      }
      // Or if we have overall societal debt that's positive (negative impact)
      else if (tx.societalDebt && tx.societalDebt > 0) {
        total += tx.amount || 0;
      }
    });

    return total;
  }, [displayTransactions]);

  // Calculate top negative impact categories for recommended offsets
  const negativeCategories = useMemo(() => {
    const categories: Record<string, number> = {};

    // Iterate through all transactions to collect category impact
    displayTransactions.forEach((tx) => {
      // Skip if no unethical practices or no practice categories
      if (!tx.unethicalPractices || !tx.practiceCategories) return;

      // Group by category
      tx.unethicalPractices.forEach((practice) => {
        const category = tx.practiceCategories?.[practice];
        if (category) {
          // Get practice weight or default to 10%
          const weight = tx.practiceWeights?.[practice] || 10;
          const impact = (tx.amount || 0) * (weight / 100);

          // Add to category total
          categories[category] = (categories[category] || 0) + impact;
        }
      });
    });

    // Convert to array and sort
    return Object.entries(categories)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3); // Top 3 categories
  }, [displayTransactions]);

  // Get the sample data generation functions
  const { generateSampleTransactions } = useSampleData();

  // Handle loading sample data from debug panel
  const handleLoadSampleData = useCallback(
    (sampleTransactions?: Transaction[]) => {
      // If no transactions are provided, generate them
      const transactions = sampleTransactions || generateSampleTransactions();

      if (!transactions || transactions.length === 0) {
        console.error("No sample transactions available");
        return;
      }

      console.log(
        `Loading ${transactions.length} sample transactions directly`
      );

      // Make sure all transactions are marked as not analyzed so your system will process them
      const rawTransactions = transactions.map((tx) => ({
        ...tx,
        analyzed: false, // Force recalculation of societalDebt
        societalDebt: undefined, // Remove any pre-calculated values
      }));

      // Skip the bank connection process and go straight to analysis
      analyzeTransactions(rawTransactions);

      // Update connection status once analysis starts
      setConnectionStatus({
        isConnected: true,
        isLoading: false,
        error: null,
      });

      // Set debug connection status for the UI
      setDebugConnectionStatus(true);
    },
    [analyzeTransactions, generateSampleTransactions]
  );

  // Handle Plaid success callback
  const handlePlaidSuccess = useCallback(
    async (publicToken: string | null) => {
      // If no token is provided but we're in dev mode, use sample data
      if (!publicToken && process.env.NODE_ENV === "development") {
        console.log("🧪 Using sample data instead of Plaid");
        handleLoadSampleData();
        return;
      }

      // If no token and not in dev mode, show error
      if (!publicToken) {
        console.error("No public token received from Plaid");
        setConnectionStatus({
          isConnected: false,
          isLoading: false,
          error: "Failed to connect bank account. Please try again.",
        });
        return;
      }

      console.log("🏦 Bank Connection Successful with token:", publicToken);

      // Set loading state
      setConnectionStatus({
        isConnected: false, // Don't set to true until we have transactions
        isLoading: true,
        error: null,
      });

      try {
        // Exchange public token for access token
        const exchangeResponse = await fetch("/api/banking/exchange_token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ public_token: publicToken }),
        });

        if (!exchangeResponse.ok) {
          throw new Error(`Token exchange failed: ${exchangeResponse.status}`);
        }

        const { access_token } = await exchangeResponse.json();

        if (!access_token) {
          throw new Error("No access token received from server");
        }

        console.log("✅ Successfully exchanged token for access_token");

        // Now get transactions with this access token
        const transactionsResponse = await fetch("/api/banking/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ access_token }),
        });

        if (!transactionsResponse.ok) {
          throw new Error(
            `Failed to fetch transactions: ${transactionsResponse.status}`
          );
        }

        const transactionsData = await transactionsResponse.json();
        console.log(
          `📊 Fetched ${transactionsData.length} transactions from Plaid`
        );

        // Map Plaid transactions to our format with type safety
        const mappedTransactions = transactionsData.map(
          (tx: Record<string, unknown>) => ({
            date: String(tx.date || ""),
            name: String(tx.name || "Unknown"),
            amount: Math.abs(Number(tx.amount) || 0),
            analyzed: false, // Ensure they get analyzed
          })
        );

        // Analyze the transactions
        if (mappedTransactions.length > 0) {
          analyzeTransactions(mappedTransactions);

          // Update connection status
          setConnectionStatus({
            isConnected: true,
            isLoading: false,
            error: null,
          });

          setDebugConnectionStatus(true);
        } else {
          // No transactions found
          setConnectionStatus({
            isConnected: true,
            isLoading: false,
            error: "No transactions found in this account",
          });
        }
      } catch (error) {
        console.error("❌ Error during Plaid connection:", error);

        // Show error to user
        setConnectionStatus({
          isConnected: false,
          isLoading: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to connect bank account",
        });

        // In sandbox mode, fall back to sample data
        if (process.env.NODE_ENV === "development") {
          console.log("⚠️ Falling back to sample data in development mode");
          setTimeout(() => {
            handleLoadSampleData();
          }, 1000);
        }
      }
    },
    [handleLoadSampleData, analyzeTransactions]
  );

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

      console.log(
        `🚨 Direct Firebase load: Found ${result.transactions.length} transactions`
      );

      // Mark all transactions as analyzed
      const markedTransactions = result.transactions.map((tx) => ({
        ...tx,
        analyzed: true,
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
    if (
      user &&
      !savedTransactions &&
      !storageLoading &&
      !directLoadAttempted &&
      !analyzedData
    ) {
      // If normal loading has completed but found no data, try direct load
      console.log(
        "🚀 Normal loading finished with no data, trying direct load"
      );
      loadDirectFromFirebase();
    }
  }, [
    user,
    savedTransactions,
    storageLoading,
    loadDirectFromFirebase,
    directLoadAttempted,
    analyzedData,
  ]);

  // Handle successful data load from Firebase (via hook or direct)
  useEffect(() => {
    if (savedTransactions && savedTransactions.length > 0 && user) {
      console.log(
        `📊 Using ${savedTransactions.length} saved transactions from hook`
      );

      // Mark all transactions as analyzed
      const markedTransactions = savedTransactions.map((tx) => ({
        ...tx,
        analyzed: true,
      }));

      analyzeTransactions(markedTransactions);
    }
  }, [savedTransactions, analyzeTransactions, user]);

  // Save analyzed data to Firebase
  useEffect(() => {
    // Only save if we have user, valid data, and haven't already saved this session
    if (
      user &&
      analyzedData &&
      analyzedData.transactions.length > 0 &&
      analysisStatus.status === "success" &&
      !hasSavedData &&
      !storageLoading &&
      !isLoadingDirect &&
      !connectionStatus.isLoading
    ) {
      // Use individual loading states

      // Add a small delay to avoid race conditions with component unmounting
      const saveTimeout = setTimeout(() => {
        console.log(
          `💾 Saving ${analyzedData.transactions.length} analyzed transactions to Firebase`
        );
        saveTransactions(
          analyzedData.transactions,
          analyzedData.totalSocietalDebt
        ).catch((err) => console.error("Failed to save to Firebase:", err));
      }, 1000); // Increased delay to avoid race conditions

      return () => clearTimeout(saveTimeout);
    }
  }, [
    user,
    analyzedData,
    analysisStatus,
    saveTransactions,
    hasSavedData,
    storageLoading,
    isLoadingDirect,
    connectionStatus.isLoading,
  ]); // Fixed dependency array

  // Reset all user transactions
  const handleResetTransactions = useCallback(async () => {
    if (!user) return Promise.resolve();

    try {
      // First reset the local state
      resetStorage();

      // Clear any connection status
      setConnectionStatus({
        isConnected: false,
        isLoading: false,
        error: null,
      });

      setDebugConnectionStatus(false);

      // Then delete from Firebase
      console.log(
        `Attempting to delete all transactions for user: ${user.uid}`
      );
      await deleteAllUserTransactions(user.uid);

      console.log("🗑️ All user transactions deleted");

      // Force page reload to reset all state
      window.location.reload();

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
      error: null,
    });

    setDebugConnectionStatus(false);

    // Also clear analyzed data if needed
    resetStorage();
  }, [resetStorage]);

  // Determine if we have data to show
  const hasData = Boolean(analyzedData && analyzedData.transactions.length > 0);

  // Get error state
  const error = connectionStatus.error || analysisStatus.error || storageError;
  const effectiveConnectionStatus =
    connectionStatus.isConnected || debugConnectionStatus;

  // Get the currently active view component
  const renderActiveView = () => {
    // Check if any loading state is active
    const isLoading =
      connectionStatus.isLoading ||
      analysisStatus.status === "loading" ||
      storageLoading ||
      isLoadingDirect;

    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner
            message={
              connectionStatus.isLoading
                ? "Loading transactions..."
                : isLoadingDirect
                ? "Loading data directly from Firebase..."
                : "Analyzing your transactions..."
            }
          />
        </div>
      );
    }

    if (!hasData) {
      return (
        <div className="flex flex-col items-center justify-center h-64 p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            No Transactions Found
          </h2>
          <p className="text-gray-600 mb-4">
            {effectiveConnectionStatus
              ? "We couldn't find any transactions in your connected account."
              : "Connect your bank or use the debug tools to load transactions."}
          </p>
          {effectiveConnectionStatus && (
            <button
              onClick={() => handleDisconnectBank()}
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
            totalSocietalDebt={
              totalSocietalDebt || analyzedData?.totalSocietalDebt || 0
            }
          />
        );
      case "categories":
        return (
          <CategoryExperimentView
            transactions={displayTransactions}
            totalSocietalDebt={
              totalSocietalDebt || analyzedData?.totalSocietalDebt || 0
            }
          />
        );
      case "practices":
        return (
          <PracticeDebtTable
            practiceDonations={practiceDonations}
            transactions={displayTransactions}
            totalSocietalDebt={
              totalSocietalDebt || analyzedData?.totalSocietalDebt || 0
            }
          />
        );
      case "grouped-impact":
        return (
          <GroupedImpactSummary
            transactions={displayTransactions}
            totalSocietalDebt={
              totalSocietalDebt || analyzedData?.totalSocietalDebt || 0
            }
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

  // Main render
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
          activeView={activeView}
          onViewChange={setActiveView}
          totalSocietalDebt={
            totalSocietalDebt || analyzedData?.totalSocietalDebt || 0
          }
          offsetsThisMonth={negativeAmount}
          positiveImpact={positiveAmount}
          topNegativeCategories={negativeCategories}
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
                Connect your bank account to analyze your transactions and
                calculate your societal debt.
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
                  <h3 className="font-bold text-gray-700 mb-2">
                    Sandbox Testing Tools
                  </h3>

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
                    <div>User ID: {user?.uid || "Not logged in"}</div>
                    <p className="mt-1 text-yellow-700">
                      <strong>Note:</strong> These options are only visible in
                      development/sandbox mode.
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
