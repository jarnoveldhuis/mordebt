// src/features/analysis/useTransactionAnalysis.ts
import { useState, useCallback, useRef } from 'react';
import { Transaction, AnalyzedTransactionData } from './types';

interface AnalysisStatus {
  status: 'idle' | 'loading' | 'success' | 'error';
  error: string | null;
}

interface UseTransactionAnalysisResult {
  analyzedData: AnalyzedTransactionData | null;
  analysisStatus: AnalysisStatus;
  analyzeTransactions: (transactions: Transaction[]) => Promise<void>;
}

// Helper function to generate a unique identifier for a transaction
function getTransactionIdentifier(transaction: Transaction): string {
  return `${transaction.date}-${transaction.name}-${transaction.amount}`;
}

export function useTransactionAnalysis(): UseTransactionAnalysisResult {
  const [analyzedData, setAnalyzedData] = useState<AnalyzedTransactionData | null>(null);
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus>({
    status: 'idle',
    error: null
  });
  
  // Use a ref to track if we're currently analyzing
  const isAnalyzing = useRef(false);

  const analyzeTransactions = useCallback(async (transactions: Transaction[]) => {
    // Skip if no transactions or we're already analyzing
    if (!transactions.length || isAnalyzing.current) {
      return;
    }

    // Set analyzing flag to prevent duplicate calls
    isAnalyzing.current = true;
    setAnalysisStatus({ status: 'loading', error: null });

    try {
      // Filter for unanalyzed transactions
      const unanalyzedTransactions = transactions.filter(tx => !tx.analyzed);
      
      console.log(`Found ${unanalyzedTransactions.length} unanalyzed transactions of ${transactions.length} total`);
      
      // If there are no unanalyzed transactions, we can skip the API call
      if (unanalyzedTransactions.length === 0) {
        console.log("No unanalyzed transactions found, calculating locally");

        // Calculate total societal debt from existing data
        const totalDebt = transactions.reduce(
          (sum, tx) => sum + (tx.societalDebt || 0),
          0
        );
        
        const totalSpent = transactions.reduce(
          (sum, tx) => sum + tx.amount,
          0
        );
        
        const debtPercentage = totalSpent > 0 ? (totalDebt / totalSpent) * 100 : 0;

        setAnalyzedData({
          transactions,
          totalSocietalDebt: totalDebt,
          debtPercentage
        });
        
        setAnalysisStatus({ status: 'success', error: null });
        isAnalyzing.current = false;
        return;
      }

      console.log(`Analyzing ${unanalyzedTransactions.length} transactions`);

      // Call the API to analyze transactions
      const response = await fetch("/api/analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactions: unanalyzedTransactions }),
      });

      if (!response.ok) {
        throw new Error(`Analysis API error: ${response.status}`);
      }

      const data = await response.json() as AnalyzedTransactionData;
      
      // Create a map of analyzed transactions keyed by transaction identifier
      const analyzedTransactionMap = new Map(
        data.transactions.map((tx) => [getTransactionIdentifier(tx), tx])
      );
      
      // Merge analyzed transactions with existing ones
      const updatedTransactions = transactions.map(tx => {
        const identifier = getTransactionIdentifier(tx);
        if (analyzedTransactionMap.has(identifier)) {
          // This is a newly analyzed transaction
          return {
            ...analyzedTransactionMap.get(identifier) as Transaction,
            analyzed: true
          };
        }
        // This is an already analyzed transaction or one that wasn't sent for analysis
        return {
          ...tx,
          analyzed: true // Mark all as analyzed to prevent repeated analysis
        };
      });

      // Sort by societal debt (largest first)
      const sortedTransactions = [...updatedTransactions].sort(
        (a, b) => (b.societalDebt ?? 0) - (a.societalDebt ?? 0)
      );

      // Calculate metrics
      const totalDebt = sortedTransactions.reduce(
        (sum, tx) => sum + (tx.societalDebt ?? 0),
        0
      );
      
      const totalSpent = sortedTransactions.reduce(
        (sum, tx) => sum + tx.amount,
        0
      );
      
      const debtPercentage = totalSpent > 0 ? (totalDebt / totalSpent) * 100 : 0;

      // Set state with the complete results
      setAnalyzedData({
        transactions: sortedTransactions,
        totalSocietalDebt: totalDebt,
        debtPercentage
      });
      
      setAnalysisStatus({ status: 'success', error: null });
      
    } catch (error) {
      console.error("Analysis error:", error);
      setAnalysisStatus({ 
        status: 'error', 
        error: error instanceof Error ? error.message : "Analysis failed" 
      });
    } finally {
      isAnalyzing.current = false;
    }
  }, []);

  return {
    analyzedData,
    analysisStatus,
    analyzeTransactions
  };
}