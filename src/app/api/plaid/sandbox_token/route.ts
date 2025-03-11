import { NextRequest, NextResponse } from "next/server";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function POST(_req: NextRequest) {
  try {
    console.log("🔍 Requesting Plaid Sandbox Token...");

    // ✅ Select the correct secret based on the environment
    const PLAID_SECRET =
      process.env.PLAID_ENV === "sandbox"
        ? process.env.PLAID_SECRET_SANDBOX
        : process.env.PLAID_SECRET_PRODUCTION;

    if (!PLAID_SECRET) {
      throw new Error("❌ Plaid secret is missing! Check your environment variables.");
    }

    const response = await fetch("https://sandbox.plaid.com/sandbox/public_token/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: process.env.PLAID_CLIENT_ID,
        secret: PLAID_SECRET, // ✅ Now using the correct secret!
        institution_id: "ins_3",
        initial_products: ["transactions"],
      }),
    });
    // ins_3 chase
    // ins_109509
    
    const data = await response.json();
    console.log("🔍 Plaid API Response:", JSON.stringify(data, null, 2));

    if (!response.ok) {
      return NextResponse.json({ error: `Plaid Error: ${data.error_message || "Unknown error"}` }, { status: 500 });
    }

    if (!data.public_token) {
      throw new Error("Plaid did not return a public_token");
    }

    return NextResponse.json({ public_token: data.public_token });
  } catch (error) {
    console.error("❌ Error creating sandbox token:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
