// src/features/banking/api/getTransactions.ts

import { NextRequest, NextResponse } from 'next/server';
import { getTransactions } from '@/features/banking/plaidService';
import { config } from '@/config';

export async function getTransactionsHandler(req: NextRequest) {
  try {
    const { access_token } = await req.json();
    
    if (!access_token) {
      return NextResponse.json(
        { error: "Missing access_token" },
        { status: 400 }
      );
    }
    
    try {

      if (config.plaid.isSandbox) {
        console.log("📝 No transactions returned in sandbox mode, using sample data...");
        return NextResponse.json(getSampleTransactions());
      }

      // Let plaidService handle retries in sandbox mode
      const transactions = await getTransactions(access_token);

      // In sandbox mode, if we get 0 transactions, synthesize some sample data
      // if (config.plaid.isSandbox && (!transactions || transactions.length === 0)) {
      //   console.log("📝 No transactions returned in sandbox mode, using sample data...");
      //   return NextResponse.json(getSampleTransactions());
      // }
      
      return NextResponse.json(transactions);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === "PRODUCT_NOT_READY") {
          return NextResponse.json(
            {
              error: "Transactions are not ready yet. Thank you for your patience.",
              retryAfter: "10 seconds",
            },
            { status: 503 } // Use HTTP 503 (Service Unavailable)
          );
        }
        
        if (error.message === "RATE_LIMITED") {
          return NextResponse.json(
            {
              error: "Too many requests to Plaid. Please try again shortly.",
              retryAfter: "30 seconds",
            },
            { status: 429 }
          );
        }
      }
      throw error;
    }
  } catch (error) {
    console.error("💥 Error in transactions route:", error);
    
    // For sandbox mode, return sample data instead of error
    if (config.plaid.isSandbox) {
      console.log("📝 Error in sandbox mode, using sample data...");
      return NextResponse.json(getSampleTransactions());
    }
    
    return NextResponse.json(
      { 
        error: "Failed to fetch transactions", 
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Helper function for sandbox mode to provide sample transactions when Plaid API is being flaky
function getSampleTransactions() {
  const currentDate = new Date();
  
  return [
    {
      transaction_id: "tx1",
      date: new Date(currentDate.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      name: "Whole Foods Market",
      amount: 84.73,
      category: ["Food and Drink", "Groceries"]
    },
    {
      transaction_id: "tx2",
      date: new Date(currentDate.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      name: "Amazon",
      amount: 37.49,
      category: ["Shops", "Online Marketplaces"]
    },
    {
      transaction_id: "tx3",
      date: new Date(currentDate.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      name: "Starbucks",
      amount: 5.25,
      category: ["Food and Drink", "Coffee Shop"]
    },
    {
      transaction_id: "tx4",
      date: new Date(currentDate.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      name: "Netflix",
      amount: 15.99,
      category: ["Service", "Subscription"]
    },
    {
      transaction_id: "tx5",
      date: new Date(currentDate.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      name: "Shell",
      amount: 48.22,
      category: ["Travel", "Gas Stations"]
    },
    {
      transaction_id: "tx6",
      date: new Date(currentDate.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      name: "Target",
      amount: 127.43,
      category: ["Shops", "Department Stores"]
    }
  ];
}