// src/features/transactions/types.ts

import { Charity } from "@/shared/types/transactions";

export interface Transaction {
  date: string;
  name: string;
  amount: number;
  societalDebt?: number;
  unethicalPractices?: string[];
  ethicalPractices?: string[];
  practiceWeights?: Record<string, number>; // percentages
  practiceDebts?: Record<string, number>; // + or -
  practiceSearchTerms?: Record<string, string>; // search terms for charity lookup
  charities?: Record<string, Charity>;
  information?: Record<string, string>; // Information per practice
}

export interface AnalyzedTransactionData {
  transactions: Transaction[];
  totalSocietalDebt: number;
  debtPercentage: number;
}

export interface AnalysisRequest {
  transactions: Transaction[];
}