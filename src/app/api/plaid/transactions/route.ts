// src/app/api/plaid/transactions/route.ts

import { NextResponse } from 'next/server';
import { getTransactions } from '@/features/banking/plaidService';

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
            error: "Transactions are not ready yet. Thank you for your patience.",
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