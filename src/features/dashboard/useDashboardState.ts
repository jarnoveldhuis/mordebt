import { useState, useCallback, useRef, useEffect } from "react";
import { useAuth } from "@/shared/hooks/useAuth";
import { useTransactionStorage } from "@/features/analysis/useTransactionStorage";
import { useTransactionAnalysis } from "@/features/analysis/useTransactionAnalysis";
import { useBankConnection } from '@/features/banking/useBankConnection';
import { Transaction } from "@/shared/types/transactions";
import {
  deleteAllUserTransactions,
  userHasData,
  loadUserTransactions,
} from "@/features/analysis/directFirebaseLoader";
import { collection, addDoc, Timestamp } from "firebase/firestore";
import { db } from "@/shared/firebase/firebase";

export function useDashboardState() {
  // Prevention flag for auto-loading after disconnect
  const preventAutoLoadRef = useRef(false);
  
  // Check if prevention flag was set in a previous session
  useEffect(() => {
    const storedPreventFlag = sessionStorage.getItem('preventAutoLoad');
    if (storedPreventFlag === 'true') {
      preventAutoLoadRef.current = true;
      
      // Clear the flag after a delay
      const timer = setTimeout(() => {
        preventAutoLoadRef.current = false;
        sessionStorage.removeItem('preventAutoLoad');
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, []);
  
  // Track direct Firebase loading state
  const [directLoadAttempted, setDirectLoadAttempted] = useState(false);
  const [isLoadingDirect, setIsLoadingDirect] = useState(false);
  const [debugConnectionStatus, setDebugConnectionStatus] = useState(false);
  const [activeView, setActiveView] = useState<string>("transactions");
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  
  // Add an override flag to forcibly disable loading UI regardless of other states
  const [forceDisableLoading, setForceDisableLoading] = useState(false);
  
  // Track explicit disconnect state
  const [wasManuallyDisconnected, setWasManuallyDisconnected] = useState(false);
  
  // Add a specific flag for the bank connection loading state
  const [bankConnecting, setBankConnecting] = useState(false);
  
  // Check for disconnected flag in session storage on init
  useEffect(() => {
    const disconnectFlag = sessionStorage.getItem('wasManuallyDisconnected');
    if (disconnectFlag === 'true') {
      setWasManuallyDisconnected(true);
    }
  }, []);

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
    setTotalSocietalDebt,
    setSavedTransactions,
  } = useTransactionStorage(user);

  // Transaction analysis
  const { analyzedData, analysisStatus, analyzeTransactions } =
    useTransactionAnalysis();

  // Bank connection with our custom hook
  const { 
    connectionStatus,
    disconnectBank,
    clearSavedTransactions
  } = useBankConnection(user);

  // Track connection status independent of actual Plaid connection
  const [localConnectionStatus, setLocalConnectionStatus] = useState({
    isConnected: false,
    isLoading: false,
    error: null as string | null,
  });

  // Add a mounted reference
  const isMountedRef = useRef(true);
  
  // Set up unmounting effect
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      console.log("Dashboard state hook unmounting");
      isMountedRef.current = false;
    };
  }, []);

  // Try to load data directly from Firebase if hook-based loading fails
  const loadDirectFromFirebase = useCallback(async () => {
    // Check stored prevention flag first (double-check)
    const storedPreventFlag = sessionStorage.getItem('preventAutoLoad');
    if (storedPreventFlag === 'true') {
      console.log("Direct Firebase load prevented by session flag");
      return;
    }
    
    if (!user || isLoadingDirect || directLoadAttempted || preventAutoLoadRef.current) return;

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

  // Effect to try direct loading if hook loading fails - now respects the prevention flag
  useEffect(() => {
    if (
      user &&
      !savedTransactions &&
      !storageLoading &&
      !directLoadAttempted &&
      !analyzedData &&
      !preventAutoLoadRef.current // Check prevention flag before auto-loading
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
    if (savedTransactions && savedTransactions.length > 0 && user && !preventAutoLoadRef.current) {
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

  // Save analyzed data to Firebase with better error handling and component unmounting protection
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
      !localConnectionStatus.isLoading &&
      !preventAutoLoadRef.current // Don't save if we're in disconnection mode
    ) {
      console.log("Setting up transaction save timeout");
      
      // Add a small delay to avoid race conditions with component unmounting
      const saveTimeout = setTimeout(() => {
        if (!isMountedRef.current) {
          console.warn("Not saving transactions - component unmounted (ref check)");
          return;
        }
        
        console.log(
          `💾 Saving ${analyzedData.transactions.length} analyzed transactions to Firebase`
        );
        
        saveTransactions(
          analyzedData.transactions,
          analyzedData.totalSocietalDebt
        )
        .then(() => {
          if (isMountedRef.current) {
            console.log("Successfully saved transactions to Firebase");
          }
        })
        .catch((err) => {
          console.error("Failed to save to Firebase:", err);
        });
      }, 1500); // Increase the delay to 1.5 seconds

      return () => {
        console.log("Clearing save timeout - component unmounting");
        clearTimeout(saveTimeout);
      };
    }
  }, [
    user,
    analyzedData,
    analysisStatus,
    saveTransactions,
    hasSavedData,
    storageLoading,
    isLoadingDirect,
    localConnectionStatus.isLoading
  ]);

  // Effect to clear bank connecting state when component unmounts
  useEffect(() => {
    return () => {
      // Reset connecting state on unmount
      setBankConnecting(false);
    };
  }, []);

  // Handle Plaid success callback
  const handlePlaidSuccess = useCallback(
    async (publicToken: string | null) => {
      // If no token provided, show error - no fallback to sample data
      if (!publicToken) {
        setLocalConnectionStatus({
          isConnected: false,
          isLoading: false,
          error: "No public token received from Plaid"
        });
        return;
      }
      
      // Set connection status to loading
      setLocalConnectionStatus({
        isConnected: false,
        isLoading: true,
        error: null
      });
      
      // Set the bank connecting flag to ensure we show a loading state
      setBankConnecting(true);
      
      // Clear manually disconnected flag since user is explicitly connecting
      setWasManuallyDisconnected(false);
      sessionStorage.removeItem('wasManuallyDisconnected');
      
      console.log("🏦 Bank Connection Successful with token:", publicToken);
      
      try {
        // Exchange public token for access token
        const exchangeResponse = await fetch("/api/banking/exchange_token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ public_token: publicToken }),
        });
  
        // Log the raw response for debugging
        console.log("Token exchange response status:", exchangeResponse.status);
        
        if (!exchangeResponse.ok) {
          const errorText = await exchangeResponse.text();
          console.error("Token exchange error response:", errorText);
          throw new Error(`Token exchange failed: ${exchangeResponse.status} - ${errorText}`);
        }
  
        const tokenData = await exchangeResponse.json();
        console.log("Token exchange response data:", tokenData);
  
        if (!tokenData.access_token) {
          throw new Error("No access token received from server");
        }
  
        console.log("✅ Successfully exchanged token for access_token");
  
        // Check if component is still mounted by checking isMountedRef
        if (!isMountedRef.current) {
          console.warn("Component unmounted during token exchange, aborting transaction fetch");
          return;
        }

        // Now get transactions with this access token
        const transactionsResponse = await fetch("/api/banking/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ access_token: tokenData.access_token }),
        });
  
        // Log the raw response for debugging
        console.log("Transactions response status:", transactionsResponse.status);
        
        if (!transactionsResponse.ok) {
          const errorText = await transactionsResponse.text();
          console.error("Transactions error response:", errorText);
          throw new Error(`Failed to fetch transactions: ${transactionsResponse.status} - ${errorText}`);
        }
  
        const transactionsData = await transactionsResponse.json();
        console.log("Raw transactions response:", transactionsData);
        
        // Check if component is still mounted again
        if (!isMountedRef.current) {
          console.warn("Component unmounted during transaction processing, aborting");
          return;
        }

        if (!Array.isArray(transactionsData)) {
          console.error("Received non-array transactions data:", transactionsData);
          throw new Error("Invalid transactions data: expected array but received " + 
            (transactionsData === null ? "null" : typeof transactionsData));
        }
  
        console.log(`📊 Fetched ${transactionsData.length} transactions from Plaid`);
  
        // Map Plaid transactions to our format with type safety and data validation
        const mappedTransactions = transactionsData.map((tx: Record<string, unknown>, index: number) => {
          // Log each transaction for debugging
          console.log(`Transaction ${index}:`, tx);
          
          // Validate and transform with defaults for missing data
          return {
            date: typeof tx.date === 'string' ? tx.date : new Date().toISOString().split('T')[0],
            name: typeof tx.name === 'string' ? tx.name : `Unknown (${index})`,
            amount: typeof tx.amount === 'number' ? Math.abs(tx.amount) : 0,
            analyzed: false // Ensure they get analyzed
          };
        });
  
        // Ensure we have valid transactions
        if (mappedTransactions.length === 0) {
          setLocalConnectionStatus({
            isConnected: true,
            isLoading: false,
            error: "No transactions found in this account"
          });
          setBankConnecting(false);
          return;
        }
  
        // Analyze the transactions
        analyzeTransactions(mappedTransactions);
  
        // Update connection status
        setLocalConnectionStatus({
          isConnected: true,
          isLoading: false,
          error: null
        });
        
        // Clear the bank connecting flag once transactions are ready
        setBankConnecting(false);
  
        setDebugConnectionStatus(true);
      } catch (error) {
        console.error("❌ Error during Plaid connection:", error);
  
        // Show detailed error to user
        setLocalConnectionStatus({
          isConnected: false,
          isLoading: false,
          error: error instanceof Error 
            ? `Connection failed: ${error.message}` 
            : "Failed to connect bank account: Unknown error"
        });
        
        // Make sure to clear the connecting state
        setBankConnecting(false);
      }
    },
    [analyzeTransactions]
  );

  // Handle loading sample data 
  const handleLoadSampleData = useCallback(
    (sampleTransactions: Transaction[]) => {
      if (!sampleTransactions || sampleTransactions.length === 0) {
        console.error("No sample transactions available");
        return;
      }

      console.log(
        `Loading ${sampleTransactions.length} sample transactions directly`
      );
      
      // Clear disconnect status when loading sample data
      setWasManuallyDisconnected(false);
      sessionStorage.removeItem('wasManuallyDisconnected');

      // Make sure all transactions are marked as not analyzed so your system will process them
      const rawTransactions = sampleTransactions.map((tx) => ({
        ...tx,
        analyzed: false, // Force recalculation of societalDebt
        societalDebt: undefined, // Remove any pre-calculated values
      }));

      // Skip the bank connection process and go straight to analysis
      analyzeTransactions(rawTransactions);

      // Update connection status once analysis starts
      setLocalConnectionStatus({
        isConnected: true,
        isLoading: false,
        error: null,
      });

      // Set debug connection status for the UI
      setDebugConnectionStatus(true);
    },
    [analyzeTransactions]
  );

  // Reset all user transactions
  const handleResetTransactions = useCallback(async () => {
    if (!user) return Promise.resolve();

    try {
      // Set prevention flag before resetting
      preventAutoLoadRef.current = true;
      
      // Clear disconnect status when resetting
      setWasManuallyDisconnected(false);
      sessionStorage.removeItem('wasManuallyDisconnected');
      
      // First reset the local state
      resetStorage();

      // Clear any connection status
      setLocalConnectionStatus({
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

      // Clear prevention flag after a delay
      setTimeout(() => {
        preventAutoLoadRef.current = false;
      }, 2000);

      // Force page reload to reset all state
      window.location.reload();

      return Promise.resolve();
    } catch (error) {
      console.error("Failed to reset transactions:", error);
      throw error;
    }
  }, [user, resetStorage]);

  // Get display transactions
  const displayTransactions = wasManuallyDisconnected 
    ? [] // Return empty array if manually disconnected
    : (analyzedData?.transactions || savedTransactions || []);
  
  // Get the effective connection status
  const effectiveConnectionStatus = wasManuallyDisconnected 
    ? false // Always show as disconnected if manually disconnected
    : (
        localConnectionStatus.isConnected || 
        connectionStatus.isConnected || 
        debugConnectionStatus ||
        // Consider having transactions as effectively connected if not manually disconnected
        (!!displayTransactions && displayTransactions.length > 0)
      );

  // Get combined error state
  const error = localConnectionStatus.error || 
               connectionStatus.error || 
               analysisStatus.error || 
               storageError;

  // Check if we have data to display
  const hasData = wasManuallyDisconnected 
    ? false // Force no data if manually disconnected 
    : Boolean(analyzedData && analyzedData.transactions.length > 0);

  // Check if any loading state is active, respecting the override
  const isLoading = forceDisableLoading ? false : (
    localConnectionStatus.isLoading ||
    connectionStatus.isLoading ||
    analysisStatus.status === "loading" ||
    storageLoading ||
    isLoadingDirect ||
    bankConnecting
  );

  // Fix stuck loading states without debug logs
  useEffect(() => {
    if (connectionStatus.isLoading) {
      // If we have transactions or saved data, but loading is still active,
      // we should consider this a loading bug and fix it
      const hasSavedTransactions = savedTransactions && savedTransactions.length > 0;
      const hasAnalyzedTransactions = analyzedData && analyzedData.transactions && analyzedData.transactions.length > 0;
      
      if (hasSavedTransactions || hasAnalyzedTransactions) {
        // Add a small delay to make sure other state updates have completed
        const fixTimeout = setTimeout(() => {
          // We can't modify connectionStatus directly since it comes from the hook,
          // but we can override the loading state completely
          setIsLoadingDirect(false);
          setLocalConnectionStatus(prev => ({
            ...prev,
            isLoading: false
          }));
          
          // Set the override flag to force loading UI to disappear
          setForceDisableLoading(true);
        }, 500);
        
        return () => clearTimeout(fixTimeout);
      }
    }
  }, [connectionStatus.isLoading, savedTransactions, analyzedData]);

  // Force loading to end after timeout without debug logs
  useEffect(() => {
    if (isLoading) {
      const timer = setTimeout(() => {
        // Can't directly modify isLoading since it's derived, 
        // but we can modify the loading states directly and set our override
        setIsLoadingDirect(false);
        setForceDisableLoading(true);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  // State to track applied credit
  const [appliedCredit, setAppliedCredit] = useState(0);
  
  // Apply credit to debt - called when user clicks "Apply" button
  const applyCreditToDebt = useCallback(async (amount: number): Promise<void> => {
    if (!user || amount <= 0) {
      return Promise.reject(new Error("Cannot apply credit - invalid user or amount"));
    }

    try {
      console.log(`Applying ${amount} credit to debt`);
      
      // Update local state to reflect change immediately
      setAppliedCredit(prev => prev + amount);
      
      // Calculate the new total debt
      const currentDebt = totalSocietalDebt || 0;
      const newTotalDebt = Math.max(0, currentDebt - amount);
      
      // Update local state immediately for UI updates
      setTotalSocietalDebt(newTotalDebt);
      
      // If we have analyzed data, update and save the new total
      if (analyzedData && analyzedData.transactions.length > 0) {
        // Add a credit application record to the transactions array
        const creditApplication = {
          date: new Date().toISOString().split('T')[0],
          name: "Applied Social Credit",
          amount: amount,
          isCreditApplication: true,
          societalDebt: -amount, // Negative value to reduce debt
          analyzed: true
        };
        
        // Mark all eligible positive impact transactions as used for credit
        // This prevents them from being counted for future credit calculations
        const updatedTransactions = analyzedData.transactions.map(tx => {
          // If this transaction contributes to positive impact
          if ((tx.ethicalPractices && tx.ethicalPractices.length > 0) || 
              (tx.societalDebt && tx.societalDebt < 0)) {
            // Mark it as used for credit
            return {
              ...tx,
              creditApplied: true // Add a flag indicating this was used for credit
            };
          }
          return tx;
        });
        
        // Add the credit application to transactions
        updatedTransactions.push(creditApplication);
        
        // Save directly to Firebase instead of using saveTransactions
        // to bypass the hasSavedData check
        const batch = {
          userId: user.uid,
          transactions: updatedTransactions,
          totalSocietalDebt: newTotalDebt,
          debtPercentage: 0, // Will be calculated below
          createdAt: Timestamp.now(),
        };
        
        // Calculate debt percentage  
        const totalSpent = updatedTransactions.reduce((sum, tx) => sum + tx.amount, 0);
        batch.debtPercentage = totalSpent > 0 ? (newTotalDebt / totalSpent) * 100 : 0;
        
        // Add to Firestore
        await addDoc(collection(db, 'transactionBatches'), batch);
        console.log('✅ Credit application saved to Firebase');
        
        // Update local state to match Firebase
        setSavedTransactions(updatedTransactions);
      }
      
      console.log("✅ Credit successfully applied");
      return Promise.resolve();
    } catch (error) {
      console.error("Error applying credit:", error);
      return Promise.reject(error);
    }
  }, [user, analyzedData, totalSocietalDebt, setTotalSocietalDebt, setSavedTransactions]);

  return {
    user,
    activeView,
    showDebugPanel,
    displayTransactions: analyzedData?.transactions || [],
    totalSocietalDebt: totalSocietalDebt || analyzedData?.totalSocietalDebt || 0,
    effectiveConnectionStatus: localConnectionStatus.isConnected || debugConnectionStatus,
    error: localConnectionStatus.error || storageError || analysisStatus.error,
    hasData: !!(analyzedData?.transactions && analyzedData.transactions.length > 0),
    isLoading:
      storageLoading ||
      analysisStatus.status === "loading" ||
      isLoadingDirect ||
      localConnectionStatus.isLoading,
    authLoading,
    bankConnecting,
    wasManuallyDisconnected,
    loadingMessage: analysisStatus.status === "loading" ? "Analyzing your transactions..." : "Loading your data...",
    
    setActiveView,
    setShowDebugPanel,
    
    handlePlaidSuccess,
    handleLoadSampleData,
    handleResetTransactions,
    handleDisconnectBank: disconnectBank,
    applyCreditToDebt,
    logout,
  };
} 