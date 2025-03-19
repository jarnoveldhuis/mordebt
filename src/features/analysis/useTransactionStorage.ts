// src/features/analysis/useTransactionStorage.ts
import { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '@/shared/firebase/firebase';
import { collection, addDoc, query, where, orderBy, getDocs, limit, Timestamp, DocumentData } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { Transaction } from '@/shared/types/transactions';
import { firebaseDebug } from '@/shared/utils/firebase-debug';

interface TransactionBatch {
  userId: string;
  transactions: Transaction[];
  totalSocietalDebt: number;
  debtPercentage: number;
  createdAt: Timestamp;
  accessToken?: string;
  id?: string;
}

interface UseTransactionStorageResult {
  savedTransactions: Transaction[] | null;
  totalSocietalDebt: number | null;
  isLoading: boolean;
  error: string | null;
  saveTransactions: (transactions: Transaction[], totalDebt: number) => Promise<void>;
  loadLatestTransactions: () => Promise<boolean>;
  hasSavedData: boolean;
  resetStorage: () => boolean;
  enableDebug: () => void;
  disableDebug: () => void;
}

// Type for state update function to fix linting errors
type StateUpdateFunction = () => void;

export function useTransactionStorage(user: User | null): UseTransactionStorageResult {
  const [savedTransactions, setSavedTransactions] = useState<Transaction[] | null>(null);
  const [totalSocietalDebt, setTotalSocietalDebt] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSavedData, setHasSavedData] = useState<boolean>(false);
  
  // Use refs to prevent multiple calls and track mounted state
  const isLoadingRef = useRef(false);
  const mountedRef = useRef(true);
  const userRef = useRef<User | null>(null);
  const previousUserIdRef = useRef<string | null>(null);
  const hasInitializedRef = useRef(false);
  
  // Add a ref to prevent auto-loading after reset
  const preventAutoLoadRef = useRef(false);
  
  // Update userRef when user changes
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Function to load the latest transaction batch
  // Define this before it's used in other functions
  const loadLatestTransactions = useCallback(async (): Promise<boolean> => {
    // Don't try to reconnect if we're already connected or if there's no user
    // or if we're preventing auto-load
    if (!user || isLoadingRef.current || preventAutoLoadRef.current) {
      return false;
    }

    console.log(`Loading latest transactions for user ${user.uid}...`);
    isLoadingRef.current = true;
    
    // Use a safe state update function
    const updateState = (stateFn: StateUpdateFunction) => {
      if (mountedRef.current) {
        stateFn();
      }
    };
    
    updateState(() => setIsLoading(true));
    updateState(() => setError(null));

    try {
      const q = query(
        collection(db, 'transactionBatches'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc'),
        limit(1)
      );

      // Log the query
      firebaseDebug.logRead('transactionBatches', {
        userId: user.uid,
        orderBy: 'createdAt desc',
        limit: 1
      }, { status: 'pending' });

      const querySnapshot = await getDocs(q);
      
      // Log the query results
      firebaseDebug.logRead('transactionBatches', {
        userId: user.uid,
        orderBy: 'createdAt desc',
        limit: 1
      }, { count: querySnapshot.size });
      
      // Check mounted state again after async operation
      if (!mountedRef.current) {
        console.warn("Component unmounted during Firebase query");
        isLoadingRef.current = false;
        return false;
      }
      
      if (querySnapshot.empty) {
        console.log('⚠️ No saved transactions found for user:', user.uid);
        updateState(() => setIsLoading(false));
        isLoadingRef.current = false;
        return false;
      }
      
      // Get the latest batch
      const doc = querySnapshot.docs[0];
      const data = doc.data() as DocumentData;
      const batch = {
        ...data as TransactionBatch,
        id: doc.id
      };

      console.log(`✅ Loaded transaction batch: ${batch.id} with ${batch.transactions.length} transactions`);

      // Update state only if still mounted
      if (mountedRef.current) {
        updateState(() => {
          setSavedTransactions(batch.transactions);
          setTotalSocietalDebt(batch.totalSocietalDebt);
          setHasSavedData(true);
          setIsLoading(false);
        });
      }
      
      isLoadingRef.current = false;
      return true;
    } catch (err) {
      console.error('❌ Error loading transactions:', err);
      if (mountedRef.current) {
        updateState(() => {
          setError('Failed to load saved transactions');
          setIsLoading(false);
        });
      }
      isLoadingRef.current = false;
      return false;
    }
  }, [user]);
  
  // Reset the storage state - with prevention flag
  const resetStorage = useCallback(() => {
    if (mountedRef.current) {
      console.log("Resetting transaction storage state");
      
      // Set prevention flag to block auto-loading
      preventAutoLoadRef.current = true;
      
      // Clear storage state
      setSavedTransactions(null);
      setTotalSocietalDebt(null);
      setError(null);
      setHasSavedData(false);
      
      // Reset loading flags
      isLoadingRef.current = false;
      
      // Clear the prevention flag after a delay
      setTimeout(() => {
        if (mountedRef.current) {
          preventAutoLoadRef.current = false;
        }
      }, 2000);
      
      return true;
    }
    return false;
  }, []);
  
  // Save transactions to Firestore
  const saveTransactions = useCallback(async (transactions: Transaction[], totalDebt: number): Promise<void> => {
    // Store values in local variables to ensure they don't change during execution
    const currentUser = userRef.current;
    const isMounted = mountedRef.current;
    
    if (!currentUser) {
      console.warn("Cannot save transactions: no user available");
      return;
    }

    if (!isMounted) {
      console.warn("Cannot save transactions: component unmounted");
      return;
    }

    // Skip if we've already saved this session or prevention flag is set
    if (hasSavedData || preventAutoLoadRef.current) {
      console.log("Skip saving - already have saved data this session or prevention flag is set");
      return;
    }

    console.log(`Attempting to save ${transactions.length} transactions to Firebase...`);
    
    // Use local state updates that check mounted status
    const updateState = (stateFn: StateUpdateFunction) => {
      if (mountedRef.current) {
        stateFn();
      }
    };
    
    updateState(() => setIsLoading(true));
    updateState(() => setError(null));

    try {
      // Calculate debt percentage
      const totalSpent = transactions.reduce((sum, tx) => sum + tx.amount, 0);
      const debtPercentage = totalSpent > 0 ? (totalDebt / totalSpent) * 100 : 0;

      // Create batch document
      const batch: Omit<TransactionBatch, 'id'> = {
        userId: currentUser.uid,
        transactions,
        totalSocietalDebt: totalDebt,
        debtPercentage,
        createdAt: Timestamp.now(),
      };

      // Log the data being saved
      firebaseDebug.logWrite('transactionBatches', batch, { status: 'pending' });

      // Add to Firestore
      const docRef = await addDoc(collection(db, 'transactionBatches'), batch);
      console.log('✅ Transaction batch saved with ID:', docRef.id);
      
      // Log successful write
      firebaseDebug.logWrite('transactionBatches', batch, { id: docRef.id });

      // Update local state only if component is still mounted
      if (mountedRef.current) {
        updateState(() => {
          setSavedTransactions(transactions);
          setTotalSocietalDebt(totalDebt);
          setHasSavedData(true);
        });
      }
    } catch (err) {
      console.error('❌ Error saving transactions:', err);
      if (mountedRef.current) {
        updateState(() => setError('Failed to save transactions'));
      }
    } finally {
      if (mountedRef.current) {
        updateState(() => setIsLoading(false));
      }
    }
  }, [hasSavedData]);

  // Handle user changes
  useEffect(() => {
    const currentUserId = user?.uid || null;
    
    // Skip initialization to avoid infinite loop
    if (hasInitializedRef.current) {
      const previousUserId = previousUserIdRef.current;
      
      // Only run for actual user changes, not initial render
      if (currentUserId !== previousUserId) {
        console.log(`User ID changed: ${previousUserId} -> ${currentUserId}`);
        
        // If user logged out
        if (!currentUserId && previousUserId) {
          console.log("User logged out, resetting storage");
          resetStorage();
        }
        
        // If a different user logged in
        if (currentUserId && previousUserId && currentUserId !== previousUserId) {
          console.log("Different user logged in, resetting storage");
          resetStorage();
        }
      }
    } else {
      // Mark as initialized
      hasInitializedRef.current = true;
    }
    
    // Update previous user ID
    previousUserIdRef.current = currentUserId;
  }, [user, resetStorage]);

  // Auto-load latest transactions only on initial mount or user change
  // Modified to respect the prevention flag
  useEffect(() => {
    // Only load if:
    // 1. We have a user
    // 2. We haven't already loaded transactions
    // 3. We're not currently loading
    // 4. The component is still mounted
    // 5. The prevention flag is not set
    if (user && 
        !savedTransactions && 
        !isLoadingRef.current && 
        mountedRef.current &&
        !preventAutoLoadRef.current) {
      
      // Store userId to check later if it's still the same
      const userId = user.uid;
      
      // Use a minimal delay to avoid rapid calls during auth state changes
      const loadTimer = setTimeout(() => {
        // Double-check all conditions again
        if (mountedRef.current && 
            userRef.current?.uid === userId && 
            !isLoadingRef.current && 
            !preventAutoLoadRef.current) {
          
          console.log(`Auto-loading transactions for user ${userId}`);
          
          loadLatestTransactions().catch(err => {
            if (mountedRef.current) {
              console.error("Failed to auto-load transactions:", err);
            }
          });
        }
      }, 500); // Delay to account for React Fast Refresh
      
      return () => clearTimeout(loadTimer);
    }
  }, [user, savedTransactions, loadLatestTransactions]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      console.log("Storage hook unmounting, setting mounted flag to false");
      mountedRef.current = false;
    };
  }, []);

  return {
    savedTransactions,
    totalSocietalDebt,
    isLoading,
    error,
    saveTransactions,
    loadLatestTransactions,
    hasSavedData,
    resetStorage,
    enableDebug: firebaseDebug.enable,
    disableDebug: firebaseDebug.disable
  };
}