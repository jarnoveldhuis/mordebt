// src/app/api/plaid/create_link_token/route.ts
import { NextResponse } from "next/server";
import {
  Configuration,
  PlaidApi,
  PlaidEnvironments,
  Products,
  CountryCode,
} from "plaid";

const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID;
const PLAID_SECRET = process.env.PLAID_SECRET;
const PLAID_ENV = process.env.PLAID_ENV as keyof typeof PlaidEnvironments;

if (!PLAID_CLIENT_ID || !PLAID_SECRET || !PLAID_ENV) {
  console.error("❌ Missing Plaid environment variables.");
}

const configuration = new Configuration({
  basePath: PlaidEnvironments[PLAID_ENV],
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": PLAID_CLIENT_ID!,
      "PLAID-SECRET": PLAID_SECRET!,
    },
  },
});
const plaidClient = new PlaidApi(configuration);

export async function GET() {
  try {
    console.log("🚀 Requesting Plaid Link Token...");

    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: crypto.randomUUID() }, // ✅ Ensure unique user ID
      client_name: "Your App Name",
      products: [Products.Transactions], // ✅ Ensure valid product
      country_codes: [CountryCode.Us], // ✅ Ensure valid country code
      language: "en",
    });

    if (!response.data.link_token) {
      throw new Error("Plaid did not return a link token.");
    }

    console.log("✅ Plaid Link Token Created:", response.data.link_token);
    return NextResponse.json({ link_token: response.data.link_token });
  } catch (error: unknown) {
    console.error("❌ Plaid API Error:", JSON.stringify(error, null, 2)); // Log full error
    return NextResponse.json(
      { error: "Failed to create link token", details: error },
      { status: 500 }
    );
  }
}
