import { NextResponse } from 'next/server';
import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from 'plaid';

const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID;
const PLAID_SECRET = process.env.PLAID_SECRET;
const PLAID_ENV = process.env.PLAID_ENV as keyof typeof PlaidEnvironments;

if (!PLAID_CLIENT_ID || !PLAID_SECRET || !PLAID_ENV) {
  console.error('❌ Missing Plaid environment variables.');
}

const configuration = new Configuration({
  basePath: PlaidEnvironments[PLAID_ENV],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': PLAID_CLIENT_ID!,
      'PLAID-SECRET': PLAID_SECRET!,
    },
  },
});
const plaidClient = new PlaidApi(configuration);

export async function GET() {
  try {
    console.log("🚀 Requesting Plaid Link Token...");

    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: 'user-id-123' },
      client_name: 'Your App Name',
      products: [Products.Transactions], // ✅ Ensure this is valid
      country_codes: [CountryCode.Us],   // ✅ Ensure this is valid
      language: 'en',
    });

    console.log("✅ Plaid Link Token Created:", response.data.link_token);
    
    return NextResponse.json({ link_token: response.data.link_token });
  } catch (error: any) {
    console.error("❌ Plaid API Error:", error.response?.data || error.message);
    return NextResponse.json({ error: error.response?.data || 'Failed to create link token' }, { status: 500 });
  }
}
