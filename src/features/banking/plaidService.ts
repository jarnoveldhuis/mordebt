// src/features/banking/plaidService.ts
import {
  Configuration,
  PlaidApi,
  PlaidEnvironments,
  Products,
  CountryCode,
  TransactionsGetResponse,
} from "plaid";
import { config } from "@/config";
import { PlaidError } from "@/shared/types/transactions";

// Initialize Plaid client
const configuration = new Configuration({
  basePath: PlaidEnvironments[config.plaid.env as keyof typeof PlaidEnvironments],
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": config.plaid.clientId!,
      "PLAID-SECRET": config.plaid.secret!,
    },
  },
});

const plaidClient = new PlaidApi(configuration);

export async function createLinkToken(): Promise<string> {
  try {
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: crypto.randomUUID() },
      client_name: "Mordebt",
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: "en",
    });

    if (!response.data.link_token) {
      throw new Error("Plaid did not return a link token.");
    }

    return response.data.link_token;
  } catch (error) {
    console.error("❌ Plaid API Error:", error);
    throw error;
  }
}

export async function exchangePublicToken(publicToken: string): Promise<string> {
  try {
    const response = await plaidClient.itemPublicTokenExchange({ public_token: publicToken });
    return response.data.access_token;
  } catch (error) {
    console.error("❌ Plaid token exchange error:", error);
    throw error;
  }
}

/**
 * Helper function to delay execution
 * @param ms Milliseconds to delay
 */
const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

// Type guard to check if error has the expected Plaid error shape
interface PlaidErrorResponse {
  response?: { 
    data?: PlaidError,
    status?: number
  };
}

function isPlaidErrorResponse(err: unknown): err is PlaidErrorResponse {
  return (
    typeof err === 'object' && 
    err !== null && 
    'response' in err &&
    typeof (err as Record<string, unknown>).response === 'object' &&
    (err as Record<string, unknown>).response !== null
  );
}

export async function getTransactions(
  accessToken: string, 
  retryCount = 0
): Promise<TransactionsGetResponse['transactions']> {
  const MAX_RETRIES = 15; // Reduced to avoid conflict with UI retries
  const RETRY_DELAY_MS = 10000 * Math.pow(2, retryCount); // Exponential backoff

  try {
    const today = new Date();
    const startDate = new Date(today.getFullYear(), today.getMonth(), -1);

    // Log the request attempt
    console.log(`🔄 Fetching Plaid transactions (attempt ${retryCount + 1}/${MAX_RETRIES + 1})...`);

    const response = await plaidClient.transactionsGet({
      access_token: accessToken,
      start_date: startDate.toISOString().split('T')[0],
      end_date: today.toISOString().split('T')[0]
    });

    return response.data.transactions;
  } catch (error) {
    // Log the complete error for debugging
    console.error(`❌ Plaid transactions error (attempt ${retryCount + 1}):`, error);
    
    // If in sandbox mode, print the actual error response to help debug
    if (config.plaid.isSandbox && isPlaidErrorResponse(error) && error.response?.data) {
      console.error('Plaid API error details:', error.response.data);
    }
    
    // For sandbox: automatically retry a few times with exponential backoff
    if (config.plaid.isSandbox && retryCount < MAX_RETRIES) {
      console.log(`⏱️ Sandbox mode: retrying in ${RETRY_DELAY_MS/10000} seconds...`);
      await delay(RETRY_DELAY_MS);
      return getTransactions(accessToken, retryCount + 1);
    }
    
    // Check for specific error types
    if (isPlaidErrorResponse(error)) {
      // Handle PRODUCT_NOT_READY error
      if (error.response?.data?.error_code === "PRODUCT_NOT_READY") {
        throw new Error("PRODUCT_NOT_READY");
      }
      
      // Handle rate limiting
      if (error.response?.status === 429) {
        throw new Error("RATE_LIMITED");
      }
    }
    
    throw error;
  }
}

/**
 * Creates a sandbox public token for testing
 * @param institutionId Optional institution ID (defaults to Chase Bank)
 * @returns Plaid public_token for sandbox testing
 */
export async function createSandboxToken(institutionId?: string): Promise<string> {
  try {
    // Ensure we have proper sandbox credentials
    const PLAID_SECRET = config.plaid.secret;
    const CLIENT_ID = config.plaid.clientId;

    if (!PLAID_SECRET || !CLIENT_ID) {
      throw new Error("Plaid credentials missing in config");
    }

    // Default to Chase Bank if no institution ID provided
    const INSTITUTION_ID = institutionId || "ins_109509"; // Chase Bank in sandbox
    
    console.log(`🏦 Creating sandbox token for institution: ${INSTITUTION_ID}`);

    const response = await fetch("https://sandbox.plaid.com/sandbox/public_token/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        secret: PLAID_SECRET,
        institution_id: INSTITUTION_ID,
        initial_products: ["transactions"],
      }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`Plaid Error: ${data.error_message || "Unknown error"}`);
    }

    if (!data.public_token) {
      throw new Error("Plaid did not return a public_token");
    }

    console.log("✅ Sandbox token created successfully");
    return data.public_token;
  } catch (error) {
    console.error("❌ Error creating sandbox token:", error);
    throw error;
  }
}