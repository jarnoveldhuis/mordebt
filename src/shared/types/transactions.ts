export interface Charity {
  name: string;
  url: string;
}

export interface Transaction {
  date: string;
  name: string;
  amount: number;
  societalDebt?: number;
  unethicalPractices?: string[];
  ethicalPractices?: string[];
  practiceWeights?: Record<string, number>; // percentages
  practiceDebts?: Record<string, number>; // + or -
  charities?: Record<string, Charity>;
  information?: Record<string, string>; // Information per practice
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