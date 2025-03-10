// src/types/index.ts
export interface Transaction {
    date: string;
    name: string;
    amount: number;
    ethics?: string;
  }
  
  // Plaid-specific types
  export interface PlaidError {
    error_code: string;
    error_message: string;
    display_message: string | null;
  }
  
  export interface PlaidLinkHandler {
    open: () => void;
    exit: () => void;
  }
  
  // API response types
  export interface LinkTokenResponse {
    link_token: string;
  }
  
  export interface TokenExchangeResponse {
    access_token: string;
  }
  
  export interface AnalysisResponse {
    transactions: Transaction[];
  }