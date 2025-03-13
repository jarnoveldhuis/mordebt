"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/shared/hooks/useAuth";
import { Transaction } from "@/shared/types/transactions";
import { Header } from "@/shared/components/Header";
import { PlaidConnectionSection } from "@/app/api/banking/PlaidConnectionSection";
import { LoadingSpinner } from "@/shared/components/ui/LoadingSpinner";
import { ErrorAlert } from "@/shared/components/ui/ErrorAlert";
import { TabView } from "@/features/analysis/TabView";
import { config } from "@/config/index";
import { useTransactionStorage } from "@/features/analysis/transactionStorageHook";

// Helper function to generate a unique identifier for a transaction
function getTransactionIdentifier(transaction: Transaction): string {
  // Create a unique ID based on date, name, and amount
  return `${transaction.date}-${transaction.name}-${transaction.amount}`;
}

export default function Dashboard() {
  const { user, loading: authLoading, logout } = useAuth();

  // Use the storage hook
  const {
    savedTransactions,
    totalSocietalDebt: savedDebt,
    isLoading: storageLoading,
    error: storageError,
    saveTransactions,
  } = useTransactionStorage(user);

  // State management
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalSocietalDebt, setTotalSocietalDebt] = useState<number | null>(null);
  const [bankConnected, setBankConnected] = useState(false);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("Loading transactions...");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisCompleted, setAnalysisCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs to prevent duplicate calls
  const isAnalyzing = useRef(false);
  const isAnalyzingManually = useRef(false);
  const hasLoadedFromStorage = useRef(false);

  // Utility functions
  function getColorClass(value: number) {
    if (value < 0) return "text-green-500";
    if (value === 0) return "text-blue-500";
    if (value <= 10) return "text-yellow-500";
    if (value <= 20) return "text-orange-500";
    if (value <= 50) return "text-red-500";
    return "text-red-700";
  }

  // Load saved transactions if available
  useEffect(() => {
    if (savedTransactions && 
        savedTransactions.length > 0 && 
        !hasLoadedFromStorage.current) {
      console.log("Loading saved transactions from Firebase");
      setTransactions(savedTransactions);
      setTotalSocietalDebt(savedDebt);
      setAnalysisCompleted(true);
      setBankConnected(true); // Mark as connected since we have data
      hasLoadedFromStorage.current = true;
    }
  }, [savedTransactions, savedDebt]);

  // Core functionality - perform transaction analysis
  const handleAnalyze = useCallback(
    async (transactionsToAnalyze: Transaction[] = transactions, skipChecks = false) => {
      // Log what we're working with
      console.log(`Checking ${transactionsToAnalyze.length} transactions for analysis`);

      // Check if we're already analyzing or if analysis has been completed
      if (!skipChecks && (analyzing || isAnalyzing.current)) {
        console.log("Analysis already in progress, skipping...");
        return;
      }

      // Skip analysis if we already have saved data and analysis is completed
      if (!skipChecks && analysisCompleted && savedTransactions && savedTransactions.length > 0) {
        console.log("Analysis already completed with saved data, skipping...");
        return;
      }

      if (transactionsToAnalyze.length === 0) {
        console.log("No transactions to analyze, skipping...");
        setLoadingTransactions(false);
        return;
      }

      // Set flags to prevent duplicate calls
      setAnalyzing(true);
      isAnalyzing.current = true;
      setError(null);

      try {
        // Filter to find only unanalyzed transactions
        const unanalyzedTransactions = transactionsToAnalyze.filter((tx) => {
          // Consider a transaction unanalyzed only if it has no societalDebt AND no practices
          const hasNoSocietalDebt = tx.societalDebt === undefined || tx.societalDebt === 0;
          const hasNoPractices =
            (!tx.unethicalPractices || tx.unethicalPractices.length === 0) &&
            (!tx.ethicalPractices || tx.ethicalPractices.length === 0);

          // Both conditions must be true to consider it unanalyzed
          return hasNoSocietalDebt && hasNoPractices;
        });

        console.log(
          `Found ${unanalyzedTransactions.length} unanalyzed transactions out of ${transactionsToAnalyze.length} total`
        );

        // If there are no unanalyzed transactions, we can skip the API call
        if (unanalyzedTransactions.length === 0) {
          console.log("No unanalyzed transactions found, skipping OpenAI API call");

          // Calculate total societal debt from existing data
          const newTotalDebt = transactionsToAnalyze.reduce(
            (sum, tx) => sum + (tx.societalDebt || 0),
            0
          );

          setTotalSocietalDebt(newTotalDebt);
          setAnalysisCompleted(true);
          return;
        }

        console.log(`Analyzing ${unanalyzedTransactions.length} new transactions`);

        // Analyze only unanalyzed transactions
        const response = await fetch("/api/analysis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transactions: unanalyzedTransactions }),
        });

        if (!response.ok) {
          throw new Error("Failed to analyze transactions");
        }

        const data = await response.json();
        if (data.transactions) {
          // Replace the unanalyzed transactions with their analyzed versions
          const analyzedTransactionMap = new Map(
            data.transactions.map((tx: Transaction) => [getTransactionIdentifier(tx), tx])
          );
          
          // Merge analyzed transactions with existing ones
          const updatedTransactions = transactionsToAnalyze.map(tx => {
            const identifier = getTransactionIdentifier(tx);
            if (analyzedTransactionMap.has(identifier)) {
              // This is a newly analyzed transaction
              return {
                ...analyzedTransactionMap.get(identifier) as Transaction,
                analyzed: true
              };
            }
            // This is an already analyzed transaction
            return {
              ...tx,
              analyzed: true
            };
          });

          // Calculate the total societal debt
          const totalDebt = updatedTransactions.reduce(
            (sum, tx) => sum + (tx.societalDebt || 0), 
            0
          );

          // Sort them by largest debt
          const sortedTransactions = updatedTransactions.sort(
            (a: Transaction, b: Transaction) => (b.societalDebt ?? 0) - (a.societalDebt ?? 0)
          );

          setTransactions(sortedTransactions);
          setTotalSocietalDebt(totalDebt);
          setAnalysisCompleted(true);
          
          // Save to Firebase
          if (user) {
            saveTransactions(sortedTransactions, totalDebt)
              .catch(err => console.error("Failed to save to Firebase:", err));
          }
          
          console.log("Analysis completed successfully");
        }
      } catch (error) {
        console.error("❌ Error in handleAnalyze:", error);
        setError(error instanceof Error ? error.message : "Failed to analyze transactions");
      } finally {
        setAnalyzing(false);
        isAnalyzing.current = false;
        isAnalyzingManually.current = false;
      }
    },
    [transactions, user, saveTransactions, analyzing, analysisCompleted, savedTransactions]
  );

  // This effect triggers analysis when needed
  useEffect(() => {
    // Only run auto-analysis if we're not manually analyzing, it hasn't been completed,
    // and there are actually transactions to analyze
    if (
      transactions.length > 0 &&
      !analysisCompleted &&
      !isAnalyzing.current &&
      !isAnalyzingManually.current
    ) {
      // Check if all transactions are already analyzed
      const anyUnanalyzedTransactions = transactions.some((tx) => {
        const hasNoSocietalDebt = tx.societalDebt === undefined || tx.societalDebt === 0;
        const hasNoPractices =
          (!tx.unethicalPractices || tx.unethicalPractices.length === 0) &&
          (!tx.ethicalPractices || tx.ethicalPractices.length === 0);
        return hasNoSocietalDebt && hasNoPractices;
      });

      if (!anyUnanalyzedTransactions) {
        console.log("All transactions already analyzed, skipping automatic analysis");

        // Calculate and set total without triggering analysis
        const totalDebt = transactions.reduce(
          (sum, tx) => sum + (tx.societalDebt || 0),
          0
        );
        setTotalSocietalDebt(totalDebt);
        setAnalysisCompleted(true);
        return;
      }

      console.log("Auto-triggering analysis from useEffect...");
      isAnalyzingManually.current = true; // Prevent the fetchTransactions from triggering again
      handleAnalyze(transactions, true); // Pass true to skip the checks
    }
  }, [transactions, analysisCompleted, handleAnalyze]);

  // Fetch transactions from the API
  const fetchTransactions = useCallback(
    async (token: string) => {
      setLoadingTransactions(true);
      setLoadingMessage("Loading transactions..."); // Reset to default message
      setError(null);

      try {
        const response = await fetch("/api/banking/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ access_token: token }),
        });

        if (response.status === 503) {
          const errorData = await response.json();
          console.warn("🚧 Transactions not ready:", errorData.error);

          // Update the loading message instead of setting an error
          setLoadingMessage("Transactions data is not ready yet. Please wait...");

          // Optionally set up an auto-retry after a delay
          setTimeout(() => {
            fetchTransactions(token);
          }, 5000); // Retry after 5 seconds

          return;
        }

        if (!response.ok) {
          throw new Error(`Server error: ${response.status}`);
        }

        const data: Transaction[] = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          console.log(`Loaded ${data.length} transactions from Plaid`);

          // When setting transactions after fetching:
          if (savedTransactions && savedTransactions.length > 0) {
            // Extract transaction IDs or unique identifiers to compare
            const existingTransactionIds = new Set(
              savedTransactions.map((tx) => getTransactionIdentifier(tx))
            );

            // Find only new transactions
            const newTransactions = data.filter(
              (tx) => !existingTransactionIds.has(getTransactionIdentifier(tx))
            );

            if (newTransactions.length === 0) {
              console.log("No new transactions to analyze, using existing data");
              // Use existing analyzed transactions
              setTransactions(savedTransactions);
              setTotalSocietalDebt(savedDebt || 0);
              setAnalysisCompleted(true);
              setLoadingTransactions(false);
              return;
            }

            console.log(`Found ${newTransactions.length} new transactions to analyze`);

            // Initialize new transactions with default values
            const newTransactionsWithDefaults = newTransactions.map((tx) => ({
              ...tx,
              societalDebt: 0,
              unethicalPractices: [],
              ethicalPractices: [],
              information: {},
              analyzed: false
            }));

            // Combine with existing analyzed transactions
            const combinedTransactions = [
              ...savedTransactions,
              ...newTransactionsWithDefaults,
            ];

            // Only analyze the new transactions
            setTransactions(combinedTransactions);
            setAnalysisCompleted(false); // Trigger analysis only for new transactions
          } else {
            // No existing transactions, analyze everything
            setTransactions(
              data.map((tx: Transaction) => ({
                ...tx,
                societalDebt: 0,
                unethicalPractices: [],
                ethicalPractices: [],
                information: {},
                analyzed: false
              }))
            );
            setAnalysisCompleted(false);
          }

          setLoadingTransactions(false);
        } else {
          console.warn("⚠️ No transactions found.");
          setError("No transactions found in your account.");
          setLoadingTransactions(false);
        }
      } catch (error) {
        console.error("❌ Error in fetchTransactions:", error);
        setError(
          error instanceof Error ? error.message : "Failed to fetch transactions"
        );
        setLoadingTransactions(false);
      }
    },
    [savedTransactions, savedDebt]
  );

  // Handle Plaid success
  const handlePlaidSuccess = useCallback(
    async (public_token?: string | null) => {
      try {
        setBankConnected(true);
        setLoadingTransactions(true);
        setError(null);

        // Check if we should use sample data
        if (config.plaid.useSampleData || config.plaid.isSandbox) {
          console.log("⚡ Using sample data instead of Plaid API...");

          // Directly call the transactions endpoint with a flag for sample data
          const response = await fetch("/api/banking/transactions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ useSampleData: true }),
          });

          if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
          }

          const data = await response.json();
          console.log(`Loaded ${data.length} sample transactions`);

          // Check if we already have analyzed transactions
          if (savedTransactions && savedTransactions.length > 0) {
            // Use the same transaction matching logic as in fetchTransactions
            const existingTransactionIds = new Set(
              savedTransactions.map((tx) => getTransactionIdentifier(tx))
            );

            const newTransactions = data.filter(
              (tx) => !existingTransactionIds.has(getTransactionIdentifier(tx))
            );

            if (newTransactions.length === 0) {
              // No new transactions, use existing analyzed data
              setTransactions(savedTransactions);
              setTotalSocietalDebt(savedDebt || 0);
              setAnalysisCompleted(true);
              setLoadingTransactions(false);
              return;
            }

            // Process new transactions (similar to above)
            const newTransactionsWithDefaults = newTransactions.map((tx) => ({
              ...tx,
              societalDebt: 0,
              unethicalPractices: [],
              ethicalPractices: [],
              information: {},
              analyzed: false
            }));

            setTransactions([
              ...savedTransactions,
              ...newTransactionsWithDefaults,
            ]);
          } else {
            // No saved transactions, analyze all
            setTransactions(
              data.map((tx: Record<string, unknown>) => ({
                ...tx,
                societalDebt: 0,
                unethicalPractices: [],
                ethicalPractices: [],
                information: {},
                analyzed: false
              }))
            );
          }

          setAnalysisCompleted(false);
          setLoadingTransactions(false);
          return;
        }

        // Regular Plaid flow (only runs if not using sample data)
        const response = await fetch("/api/banking/exchange_token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ public_token }),
        });

        if (!response.ok) {
          throw new Error("Failed to exchange Plaid token");
        }

        const data = await response.json();
        if (data.access_token) {
          console.log("✅ Received Plaid Access Token");
          fetchTransactions(data.access_token);
        } else {
          throw new Error("No access token received from Plaid");
        }
      } catch (error) {
        console.error("❌ Error in handlePlaidSuccess:", error);
        setError(
          error instanceof Error ? error.message : "Failed to connect bank account"
        );
        setBankConnected(false);
        setLoadingTransactions(false);
      }
    },
    [fetchTransactions, savedTransactions, savedDebt]
  );

  // Auto-connect in sandbox mode
  useEffect(() => {
    if (
      config.plaid.isSandbox &&
      user &&
      !bankConnected &&
      !loadingTransactions &&
      !hasLoadedFromStorage.current // Don't auto-connect if we've loaded from storage
    ) {
      console.log("🏦 Auto-connecting in sandbox mode...");
      handlePlaidSuccess(); // No token needed, will auto-generate one
    }
  }, [user, bankConnected, loadingTransactions, handlePlaidSuccess]);

  // Render loading state during authentication or storage loading
  if (authLoading || storageLoading) {
    return (
      <div className="text-center mt-10">
        <LoadingSpinner
          message={
            authLoading ? "Checking authentication..." : "Loading your saved data..."
          }
        />
      </div>
    );
  }

  // Redirect if no user is found (this is handled by useAuth hook now)
  if (!user) {
    return <div className="text-center mt-10">Redirecting to login...</div>;
  }

  // Main render
  return (
    <div className="min-h-screen bg-gray-100 flex justify-center">
      <div className="bg-white shadow-lg rounded-lg p-4 sm:p-8 max-w-2xl w-full mt-4 sm:mt-8">
        {/* Header with user info and logout */}
        <Header user={user} onLogout={logout} />

        <h1 className="text-3xl font-bold text-gray-900 text-center mb-3">
          Societal Debt Calculator
        </h1>

        {/* Error display - show both API and storage errors */}
        {error && <ErrorAlert message={error} />}
        {storageError && <ErrorAlert message={storageError} />}

        {/* Plaid connection section - only show if no transactions or saved data */}
        {!bankConnected && !config.plaid.isSandbox && (
          <PlaidConnectionSection onSuccess={handlePlaidSuccess} />
        )}

        {/* Loading states */}
        {bankConnected && loadingTransactions && (
          <LoadingSpinner message={loadingMessage} />
        )}

        {analyzing && !loadingTransactions && (
          <LoadingSpinner message="Calculating your societal debt..." />
        )}

        {/* Main content areas - only show TabView when we have transactions and aren't loading */}
        {transactions.length > 0 && !loadingTransactions && !analyzing && (
          <TabView
            transactions={transactions}
            totalSocietalDebt={totalSocietalDebt || 0}
            getColorClass={getColorClass}
          />
        )}
      </div>
    </div>
  );
}