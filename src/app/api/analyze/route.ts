// src/app/api/analyze/route.ts

import { NextRequest, NextResponse } from "next/server";
import { analyzeTransactions } from "@/features/transactions/analyzeTransactions";

export async function POST(req: NextRequest) {
  try {
    // Parse incoming JSON: the transactions the user wants analyzed
    const { transactions } = await req.json();
    
    const analysis = await analyzeTransactions(transactions);
    
    return NextResponse.json(analysis);
  } catch (error) {
    console.error("❌ API Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}