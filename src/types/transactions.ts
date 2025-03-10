export interface Transaction {
  date: string;
  name: string;
  amount: number;
  societalDebt?: number;
  unethicalPractices?: string[];
  ethicalPractices?: string[];
  information?: string;
  charities?: Record<string, Charity>;
  practiceDebts?: Record<string, number>; // + or -
  practiceWeights?: Record<string, number>; // percentages
}

export interface Charity {
  name: string;
  url: string;
}

export interface AnalyzedTransactionData {
  transactions: Transaction[];
  totalSocietalDebt: number;
  debtPercentage: number;
}

export interface PlaidError {
  error_code: string;
  error_message: string;
  display_message: string | null;
}