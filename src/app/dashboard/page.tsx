"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/shared/hooks/useAuth";
import { Transaction } from '@/shared/types/transactions';
import { Header } from "@/shared/components/Header";
import { PlaidConnectionSection } from "@/app/api/banking/PlaidConnectionSection";
import { LoadingSpinner } from "@/shared/components/ui/LoadingSpinner";
import { ErrorAlert } from "@/shared/components/ui/ErrorAlert";
import { TabView } from "@/features/analysis/TabView";
import { config } from "@/config/index";
import { useTransactionStorage } from "@/features/analysis/transactionStorageHook"; 

export default function Dashboard() {
  const { user, loading: authLoading, logout } = useAuth();
  // Use the storage hook
  const { 
    savedTransactions, 
    totalSocietalDebt: savedDebt, 
    isLoading: storageLoading, 
    error: storageError,
    saveTransactions
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
    if (savedTransactions && savedTransactions.length > 0 && !analysisCompleted) {
      console.log("Loading saved transactions from Firebase");
      setTransactions(savedTransactions);
      setTotalSocietalDebt(savedDebt);
      setAnalysisCompleted(true);
    }
  }, [savedTransactions, savedDebt, analysisCompleted]);

  // Core functionality
  const handleAnalyze = useCallback(
    async (transactionsToAnalyze: Transaction[] = transactions, skipChecks = false) => {
      // Check if we're already analyzing or if analysis has been completed (unless skipChecks is true)
      if (!skipChecks && (analyzing || isAnalyzing.current)) {
        console.log("Analysis already in progress, skipping...");
        return;
      }

      if (!skipChecks && analysisCompleted) {
        console.log("Analysis already completed, skipping...");
        return;
      }

      if (transactionsToAnalyze.length === 0) {
        console.log("No transactions to analyze, skipping...");
        return;
      }

      // Set flags to prevent duplicate calls
      setAnalyzing(true);
      isAnalyzing.current = true;
      
      setTotalSocietalDebt(null);
      setError(null);

      console.log("Starting transaction analysis...");

      try {
        const response = await fetch("/api/analysis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transactions: transactionsToAnalyze }),
        });

        if (!response.ok) {
          throw new Error("Failed to analyze transactions");
        }

        const data = await response.json();
        if (data.transactions) {
          // Sort them by largest debt
          const sortedTransactions = data.transactions
            .map((t: Transaction) => ({
              ...t,
              unethicalPractices: t.unethicalPractices || [],
              ethicalPractices: t.ethicalPractices || [],
              charities: t.charities || {},
              information: t.information || {},
            }))
            .sort(
              (a: Transaction, b: Transaction) =>
                (b.societalDebt ?? 0) - (a.societalDebt ?? 0)
            );

          setTransactions(sortedTransactions);
          setTotalSocietalDebt(data.totalSocietalDebt);
          setAnalysisCompleted(true);
          
          // Save to Firebase
          if (user) {
            saveTransactions(sortedTransactions, data.totalSocietalDebt)
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
    [transactions, analysisCompleted, analyzing, user, saveTransactions]
  );

  // This effect only runs when transactions change and analysis hasn't been done
  useEffect(() => {
    // Only run auto-analysis if we're not manually analyzing and it hasn't been completed
    if (
      transactions.length > 0 && 
      !analysisCompleted && 
      !isAnalyzing.current && 
      !isAnalyzingManually.current
    ) {
      console.log("Auto-triggering analysis from useEffect...");
      isAnalyzingManually.current = true; // Prevent the fetchTransactions from triggering again
      handleAnalyze(transactions, true); // Pass true to skip the checks
    }
  }, [transactions, analysisCompleted, handleAnalyze]);
  
  const fetchTransactions = useCallback(async (token: string) => {
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
        
        // Set the transactions but DO NOT trigger analysis here
        setTransactions(
          data.map((t: Transaction) => ({
            ...t,
            societalDebt: 0,
            unethicalPractices: t.unethicalPractices || [],
            ethicalPractices: t.ethicalPractices || [],
            information: t.information || {}
          }))
        );
        
        // Reset analysis state
        setAnalysisCompleted(false);
        setLoadingTransactions(false);
        
        // Let the useEffect trigger the analysis instead
      } else {
        console.warn("⚠️ No transactions found.");
        setError("No transactions found in your account.");
        setLoadingTransactions(false);
      }
    } catch (error) {
      console.error("❌ Error in fetchTransactions:", error);
      setError(error instanceof Error ? error.message : "Failed to fetch transactions");
      setLoadingTransactions(false);
    }
  }, []);

  // Handle Plaid success
  const handlePlaidSuccess = useCallback(async (public_token?: string) => {
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
        
        setTransactions(
          data.map((t: Record<string, unknown>) => ({

            ...t,
            societalDebt: 0,
            unethicalPractices: t.unethicalPractices || [],
            ethicalPractices: t.ethicalPractices || [],
            information: t.information || {}
          }))
        );
        
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
      setError(error instanceof Error ? error.message : "Failed to connect bank account");
      setBankConnected(false);
      setLoadingTransactions(false);
    }
  }, [fetchTransactions]);

  // Auto-connect in sandbox mode
  useEffect(() => {
    if (config.plaid.isSandbox && user && !bankConnected && !loadingTransactions) {
      console.log("🏦 Auto-connecting in sandbox mode...");
      handlePlaidSuccess(); // No token needed, will auto-generate one
    }
  }, [user, bankConnected, loadingTransactions, handlePlaidSuccess]);

  // Render loading state during authentication or storage loading
  if (authLoading || storageLoading) {
    return (
      <div className="text-center mt-10">
        <LoadingSpinner message={authLoading ? "Checking authentication..." : "Loading your saved data..."} />
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

        {/* Plaid connection section */}
        {!bankConnected && !analysisCompleted && !config.plaid.isSandbox && (
          <PlaidConnectionSection onSuccess={handlePlaidSuccess} />
        )}

        {/* Loading states */}
        {bankConnected && loadingTransactions && (
          <LoadingSpinner message={loadingMessage} />
        )}

        {analyzing && (
          <LoadingSpinner message="Calculating your societal debt..." />
        )}

        {/* Main content areas */}
        {transactions.length > 0 && !loadingTransactions && (
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