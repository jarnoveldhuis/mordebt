// src/features/banking/api/createLinkToken.ts

import { NextRequest, NextResponse } from "next/server";
import { createLinkToken } from "@/features/banking/plaidService";

export async function createLinkTokenHandler(req: NextRequest) {
  try {
    console.log("🚀 Requesting Plaid Link Token...");
    
    const linkToken = await createLinkToken();
    
    console.log("✅ Plaid Link Token Created:", linkToken);
    return NextResponse.json({ link_token: linkToken });
  } catch (error) {
    console.error("❌ Plaid API Error:", error);
    return NextResponse.json(
      { error: "Plaid API request failed", details: error instanceof Error ? error.message : error },
      { status: 500 }
    );
  }
}