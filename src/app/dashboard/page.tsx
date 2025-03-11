"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/shared/hooks/useAuth";
import { Transaction } from '@/shared/types/transactions';
import { Header } from "@/shared/components/Header";
import { PlaidConnectionSection } from "@/app/api/plaid/PlaidConnectionSection";
import { TransactionList } from "@/features/transactions/TransactionList";
import { PracticeDebtTable } from "@/features/transactions/PracticeDebtTable";
import { LoadingSpinner } from "@/shared/components/ui/LoadingSpinner";
import { ErrorAlert } from "@/shared/components/ui/ErrorAlert";
import { config } from "@/config/index";

export default function Dashboard() {
  const { user, loading: authLoading, logout } = useAuth();

  // State management
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalSocietalDebt, setTotalSocietalDebt] = useState<number | null>(null);
  const [selectedCharity] = useState<string | null>(null);
  const [practiceDonations, setPracticeDonations] = useState<
    Record<string, { charity: { name: string; url: string } | null; amount: number }>
  >({});
  const [bankConnected, setBankConnected] = useState(false);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
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
        const response = await fetch("/api/analyze", {
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

          let totalDebt = 0;
          const newPracticeDonations: Record<
            string,
            { charity: { name: string; url: string } | null; amount: number }
          > = {};

          data.transactions.forEach((tx: Transaction) => {
            totalDebt += tx.societalDebt || 0;
            Object.entries(tx.practiceDebts || {}).forEach(
              ([practice, amount]) => {
                const assignedCharity = tx.charities?.[practice] || null;
                if (!newPracticeDonations[practice]) {
                  newPracticeDonations[practice] = {
                    charity: assignedCharity,
                    amount: 0,
                  };
                }
                newPracticeDonations[practice].amount += amount;
              }
            );
          });

          setTotalSocietalDebt(totalDebt);
          setPracticeDonations(newPracticeDonations);
          setAnalysisCompleted(true);
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
    [transactions, analysisCompleted, analyzing]
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
    setError(null);
    let productNotReady = false;

    try {
      const response = await fetch("/api/plaid/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token: token }),
      });

      if (response.status === 503) {
        productNotReady = true;
        const errorData = await response.json();
        console.warn("🚧 Transactions not ready:", errorData.error);
        setError("Transactions data is not ready yet. Thank you for your patience.");
        // Optionally schedule an auto-retry in 10 seconds:
        setTimeout(() => fetchTransactions(token), 10000);
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
          data.map((t) => ({
            ...t,
            societalDebt: 0,
            unethicalPractices: t.unethicalPractices || [],
            ethicalPractices: t.ethicalPractices || [],
            information: t.information || {}
          }))
        );
        
        // Reset analysis state
        setAnalysisCompleted(false);
        
        // Let the useEffect trigger the analysis instead
      } else {
        console.warn("⚠️ No transactions found.");
        setError("No transactions found in your account.");
      }
    } catch (error) {
      console.error("❌ Error in fetchTransactions:", error);
      setError(error instanceof Error ? error.message : "Failed to fetch transactions");
    } finally {
      // Only stop spinner if it wasn't "PRODUCT_NOT_READY"
      if (!productNotReady) {
        setLoadingTransactions(false);
      }
    }
  }, []);

  const handlePlaidSuccess = useCallback(async (public_token?: string) => {
    try {
      setBankConnected(true);
      setLoadingTransactions(true);
      setError(null);

      // In sandbox mode, auto-generate a token if not provided
      if (!public_token && config.plaid.isSandbox) {
        console.log("⚡ Bypassing Plaid UI in Sandbox...");
        try {
          const sandboxResponse = await fetch("/api/plaid/sandbox_token", {
            method: "POST"
          });
          
          if (!sandboxResponse.ok) {
            throw new Error("Failed to generate sandbox token");
          }
          
          const sandboxData = await sandboxResponse.json();
          public_token = sandboxData.public_token;
          console.log("✅ Generated Sandbox Public Token");
        } catch (error) {
          console.error("❌ Error generating sandbox token:", error);
          throw new Error("Failed to generate sandbox token");
        }
      }

      const response = await fetch("/api/plaid/exchange_token", {
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

  // Render loading state during authentication check
  if (authLoading) {
    return <div className="text-center mt-10"><LoadingSpinner message="Checking authentication..." /></div>;
  }

  // Redirect if no user is found (this is handled by useAuth hook now)
  if (!user) {
    return <div className="text-center mt-10">Redirecting to login...</div>;
  }

  // Main render
  return (
    <div className="min-h-screen bg-gray-100 flex justify-center items-center">
      <div className="bg-white shadow-lg rounded-lg p-8 max-w-2xl w-full">
        {/* Header with user info and logout */}
        <Header user={user} onLogout={logout} />

        <h1 className="text-3xl font-bold text-gray-900 text-center mb-3">
          Societal Debt Calculator
        </h1>

        {/* Error display */}
        {error && <ErrorAlert message={error} />}

        {/* Plaid connection section */}
        {!bankConnected && !config.plaid.isSandbox && (
          <PlaidConnectionSection onSuccess={handlePlaidSuccess} />
        )}

        {/* Loading states */}
        {bankConnected && loadingTransactions && (
          <LoadingSpinner message="Loading transactions..." />
        )}

        {analyzing && (
          <LoadingSpinner message="Calculating your societal debt..." />
        )}

        {/* Main content areas */}
        {transactions.length > 0 && !loadingTransactions && (
          <TransactionList 
            transactions={transactions} 
            getColorClass={getColorClass} 
          />
        )}

        {totalSocietalDebt !== null && !analyzing && (
          <PracticeDebtTable
            practiceDonations={practiceDonations}
            transactions={transactions}
            totalSocietalDebt={totalSocietalDebt}
            selectedCharity={selectedCharity}
          />
        )}
      </div>
    </div>
  );
}