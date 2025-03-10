import { NextResponse } from 'next/server';
import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';

const PLAID_SECRET =
process.env.PLAID_ENV === "sandbox"
  ? process.env.PLAID_SECRET_SANDBOX
  : process.env.PLAID_SECRET_PRODUCTION;

const config = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV as keyof typeof PlaidEnvironments],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID!,
      'PLAID-SECRET': PLAID_SECRET!,
    },
  },
});

const plaidClient = new PlaidApi(config);

export async function POST(req: Request) {
  try {
    // Read request body safely
    const rawBody = await req.text();
    console.log('Raw request body:', rawBody);

    if (!rawBody) {
      return NextResponse.json({ error: 'Request body is empty' }, { status: 400 });
    }

    // Parse JSON safely
    let body;
    try {
      body = JSON.parse(rawBody);
    } catch (error) {
      console.error('JSON Parse Error:', error);
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { public_token } = body;
    console.log('Parsed public_token:', public_token);

    if (!public_token) {
      return NextResponse.json({ error: 'Missing public_token' }, { status: 400 });
    }

    // Exchange public_token for access_token
    const response = await plaidClient.itemPublicTokenExchange({ public_token });
    const access_token = response.data.access_token;
    console.log("✅ Access Token Received:", access_token);

    return NextResponse.json({ access_token });
  } catch (error) {
    console.error('Plaid Token Exchange Error:', error);
    return NextResponse.json({ error: 'Plaid token exchange failed' }, { status: 500 });
  }
}
