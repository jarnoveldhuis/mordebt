// src/app/api/analyze/route.ts
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
  timeout: 120000, // ✅ Extended timeout to prevent 504 errors
});

interface Transaction {
  date: string;
  name: string;
  amount: number;
  ethics: string;
  ethicsScore: number;
  societalDebt: number;
  charity?: { name: string; url: string };
}

interface OpenAIResponse {
  transactions: Transaction[];
  summary: string;
  spendingType: string;
  charities: { name: string; url: string }[];
}

export async function POST(req: NextRequest) {
  try {
    const { transactions }: { transactions: Transaction[] } = await req.json();

    if (!transactions || !Array.isArray(transactions)) {
      return NextResponse.json(
        { error: "Invalid transactions data" },
        { status: 400 }
      );
    }

    console.log("📡 Sending request to OpenAI...");

    // Send request to OpenAI with structured JSON response
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an AI that analyzes financial transactions to provide ethical insights. Use a tone similar to Stephen Fry mixing subtle humor with education.
          - For each transaction, provide:
            - An ethics score (-100 to 100) reflecting how evil the purchase is. Positive scores are evil, negative scores are good. 0 is neutral. If the transaction is ambiguous, use 0.
            - The most **unethical practice** the vendor is associated with or the most **ethical practice** the vendor is associated with.
            - A **charities object** mapping practices to suggested charities.
          
          Return only structured JSON:
          {
            "transactions": [
              {
                "date": "YYYY-MM-DD",
                "name": "Merchant Name",
                "amount": 0.00,
                "ethicsScore": 0,
                "unethicalPractices": ["🏭 Factory Farming"],
                "ethicalPractices": ["🌱 Sustainable Sourcing"],
                "charities": {
                  "🏭 Factory Farming": { "name": "Humane Farming Foundation", "url": "https://hff.org" },
                  "🌎 High Emissions": { "name": "Carbon Offsets Fund", "url": "https://carbonoffsets.org" }
                }
              }
            ],
            "summary": "1 - 2 sentences educating the user on their contributions to unethical practices.",
            "spendingType": "A category based on the user's ethical weaknesses or strengths."
          }`,
        },
        { role: "user", content: JSON.stringify({ transactions }) },
      ],
      temperature: 0.5,
      max_tokens: 2000,
      response_format: { type: "json_object" },
    });

    console.log("🔍 OpenAI response received.");

    // ✅ Ensure OpenAI response is valid before parsing
    const rawContent = response.choices[0]?.message?.content;
    if (!rawContent || rawContent.startsWith("An error occurred")) {
      console.error("❌ OpenAI API Error:", rawContent);
      return NextResponse.json(
        { error: "OpenAI request failed. Please try again later." },
        { status: 500 }
      );
    }

    let analyzedData: OpenAIResponse;
    try {
      analyzedData = JSON.parse(rawContent) as OpenAIResponse;
    } catch (error) {
      console.error("❌ Error parsing OpenAI response:", error);
      return NextResponse.json(
        { error: "Invalid JSON response from OpenAI", rawResponse: rawContent },
        { status: 500 }
      );
    }

    if (!analyzedData || !analyzedData.transactions) {
      return NextResponse.json(
        { error: "Invalid response from OpenAI" },
        { status: 500 }
      );
    }

    console.log("📊 Processing transactions...");

    // Compute societal debt for each transaction
    const updatedTransactions = analyzedData.transactions.map(
      (t: Transaction) => ({
        ...t,
        societalDebt: (t.amount * t.ethicsScore) / 100,
      })
    );

    // Calculate total societal debt and total spent
    const totalSocietalDebt = updatedTransactions.reduce(
      (sum, t) => sum + t.societalDebt,
      0
    );
    const totalSpent = updatedTransactions.reduce(
      (sum, t) => sum + t.amount,
      0
    );

    // Avoid division by zero
    const debtPercentage =
      totalSpent > 0 ? (totalSocietalDebt / totalSpent) * 100 : 0;

    console.log("✅ Analysis complete. Sending response.");

    return NextResponse.json({
      transactions: updatedTransactions,
      summary: analyzedData.summary,
      totalSocietalDebt,
      debtPercentage,
      spendingType: analyzedData.spendingType,
      charities: analyzedData.charities,
    });
  } catch (error) {
    console.error("❌ API Error:", error);
    return NextResponse.json(
      { error: "Internal server error. Please try again later." },
      { status: 500 }
    );
  }
}
