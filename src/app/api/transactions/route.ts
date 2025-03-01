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

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    console.log('🔹 Raw request body:', rawBody);

    const { access_token } = JSON.parse(rawBody);
    console.log('🔹 Received access_token:', access_token);

    if (!access_token) {
      return NextResponse.json({ error: 'Missing access_token' }, { status: 400 });
    }

    const response = await plaidClient.transactionsGet({
      access_token,
      start_date: '2024-01-01',
      end_date: '2024-12-31',
    });

    console.log('✅ Transactions from Plaid:', response.data.transactions);

    return NextResponse.json(response.data.transactions);
  } catch (error) {
    console.error('❌ Plaid Transactions Error:', error);
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
  }
}
