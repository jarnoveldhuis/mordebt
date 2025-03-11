import {
  Configuration,
  PlaidApi,
  PlaidEnvironments,
  Products,
  CountryCode,
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

export async function createLinkToken() {
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

export async function exchangePublicToken(publicToken: string) {
  try {
    const response = await plaidClient.itemPublicTokenExchange({ public_token: publicToken });
    return response.data.access_token;
  } catch (error) {
    console.error("❌ Plaid token exchange error:", error);
    throw error;
  }
}

export async function getTransactions(accessToken: string) {
  try {
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const response = await plaidClient.transactionsGet({
      access_token: accessToken,
      start_date: firstDayOfMonth.toISOString().split('T')[0],
      end_date: today.toISOString().split('T')[0],
    });

    return response.data.transactions;
  } catch (error) {
    console.error("❌ Plaid transactions error:", error);
    
    // Type guard to check if error has the expected shape
    interface PlaidErrorResponse {
      response?: { 
        data?: PlaidError 
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
    
    if (isPlaidErrorResponse(error) && error.response?.data?.error_code === "PRODUCT_NOT_READY") {
      throw new Error("PRODUCT_NOT_READY");
    }
    
    throw error;
  }
}

export async function createSandboxToken() {
  try {
    const response = await fetch("https://sandbox.plaid.com/sandbox/public_token/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: config.plaid.clientId,
        secret: config.plaid.secret,
        institution_id: "ins_1",
        initial_products: ["transactions"],
      }),
    });
// ins_109508
// ins_128026 
// ins_3
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`Plaid Error: ${data.error_message || "Unknown error"}`);
    }

    if (!data.public_token) {
      throw new Error("Plaid did not return a public_token");
    }

    return data.public_token;
  } catch (error) {
    console.error("❌ Error creating sandbox token:", error);
    throw error;
  }
}