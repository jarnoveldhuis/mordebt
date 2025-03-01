import { NextResponse } from 'next/server';
import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';

const config = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV as keyof typeof PlaidEnvironments],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID!,
      'PLAID-SECRET': process.env.PLAID_SECRET!,
    },
  },
});

const plaidClient = new PlaidApi(config);

export async function GET() {
  try {
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: 'user-id-123' },
      client_name: 'Your App Name',
      products: ['transactions'],
      country_codes: ['US'],
      language: 'en',
    });

    return NextResponse.json({ link_token: response.data.link_token });
  } catch (error) {
    console.error('Plaid Link Token Error:', error);
    return NextResponse.json({ error: 'Failed to create link token' }, { status: 500 });
  }
}
