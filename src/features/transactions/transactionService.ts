// src/features/transactions/transactionService.ts

import { db } from "@/shared/firebase/firebase";
import { collection, addDoc, getDocs, query, where, orderBy, Timestamp, doc, setDoc, limit } from "firebase/firestore";
import { Transaction, AnalyzedTransactionData } from "@/shared/types/transactions";

// Interface for transaction data stored in Firestore
interface FirestoreTransaction extends Omit<Transaction, 'date'> {
  date: Timestamp;
  userId: string;
  createdAt: Timestamp;
  accessToken?: string;
}

interface TransactionBatch {
  userId: string;
  transactions: Transaction[];
  totalSocietalDebt: number;
  debtPercentage: number;
  createdAt: Timestamp;
  accessToken?: string;
}

// Save a batch of analyzed transactions
export async function saveAnalyzedTransactions(
  userId: string, 
  data: AnalyzedTransactionData,
  accessToken?: string
): Promise<string> {
  try {
    // Create a batch document
    const batch: TransactionBatch = {
      userId,
      transactions: data.transactions,
      totalSocietalDebt: data.totalSocietalDebt,
      debtPercentage: data.debtPercentage,
      createdAt: Timestamp.now(),
      accessToken // Store for future transaction updates
    };

    // Add to batches collection
    const docRef = await addDoc(collection(db, "transactionBatches"), batch);
    
    console.log("Transaction batch saved with ID:", docRef.id);
    return docRef.id;
  } catch (error) {
    console.error("Error saving transactions:", error);
    throw new Error("Failed to save transactions");
  }
}

// Get all transaction batches for a user
export async function getUserTransactionBatches(userId: string): Promise<TransactionBatch[]> {
  try {
    const q = query(
      collection(db, "transactionBatches"), 
      where("userId", "==", userId),
      orderBy("createdAt", "desc")
    );

    const querySnapshot = await getDocs(q);
    const batches: TransactionBatch[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data() as TransactionBatch;
      batches.push({
        ...data,
        id: doc.id
      } as TransactionBatch & { id: string });
    });
    
    return batches;
  } catch (error) {
    console.error("Error getting user transaction batches:", error);
    throw new Error("Failed to load transaction history");
  }
}

// Get the most recent transaction batch for a user
export async function getLatestTransactionBatch(userId: string): Promise<TransactionBatch | null> {
  try {
    const q = query(
      collection(db, "transactionBatches"), 
      where("userId", "==", userId),
      orderBy("createdAt", "desc"),
      limit(1)
    );

    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return null;
    }
    
    const doc = querySnapshot.docs[0];
    const data = doc.data() as TransactionBatch;
    
    return {
      ...data,
      id: doc.id
    } as TransactionBatch & { id: string };
  } catch (error) {
    console.error("Error getting latest transaction batch:", error);
    throw new Error("Failed to load latest transactions");
  }
}