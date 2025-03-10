// src/app/api/plaid/transactions/route.ts

import { NextResponse } from 'next/server';
import { getTransactions } from '@/lib/plaid/plaidService';

export async function POST(req: Request) {
  try {
    const { access_token } = await req.json();
    
    try {
      const transactions = await getTransactions(access_token);
      return NextResponse.json(transactions);
    } catch (error) {
      if (error instanceof Error && error.message === "PRODUCT_NOT_READY") {
        return NextResponse.json(
          {
            error: "Transactions are not ready yet. Please wait and try again.",
            retryAfter: "1 hour",
          },
          { status: 503 } // Use HTTP 503 (Service Unavailable)
        );
      }
      throw error;
    }
  } catch (error) {
    return NextResponse.json(
      { 
        error: "Failed to fetch transactions", 
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// import { NextResponse } from 'next/server';
// import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';


// // Validate environment variables
// const PLAID_SECRET =
//   process.env.PLAID_ENV === "sandbox"
//     ? process.env.PLAID_SECRET_SANDBOX
//     : process.env.PLAID_SECRET_PRODUCTION;

// // Initialize Plaid client
// const config = new Configuration({
//   basePath: PlaidEnvironments[process.env.PLAID_ENV as keyof typeof PlaidEnvironments],
//   baseOptions: {
//     headers: {
//       'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID!,
//       'PLAID-SECRET': PLAID_SECRET!,
//     },
//   },
// });

// const plaidClient = new PlaidApi(config);

// const today = new Date();
// const daysAgo = new Date();
// daysAgo.setDate(today.getDate() - 7);

// // Define Plaid error type for better safety
// interface PlaidError {
//   response?: {
//     data?: {
//       error_code?: string;
//     };
//   };
// }

// export async function POST(req: Request) {
//   try {
//     const { access_token }: { access_token: string } = await req.json();

//     const response = await plaidClient.transactionsGet({
//       access_token,
//       start_date: daysAgo.toISOString().split('T')[0],
//       end_date: today.toISOString().split('T')[0],
//     });

//     return NextResponse.json(response.data.transactions);
//   } catch (error: unknown) {
//     const plaidError = error as PlaidError;

//     if (plaidError.response?.data?.error_code === "PRODUCT_NOT_READY") {
//       return NextResponse.json(
//         {
//           error: "Transactions are not ready yet. Please wait and try again.",
//           retryAfter: "1 hour",
//         },
//         { status: 503 } // Use HTTP 503 (Service Unavailable)
//       );
//     }

//     return NextResponse.json(
//       { 
//         error: "Failed to fetch transactions", 
//         details: plaidError.response?.data || "Unknown error",
//       },
//       { status: 500 }
//     );
//   }
// }
