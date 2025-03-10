// src/app/api/analyze/route.ts

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

interface Transaction {
  date: string;
  name: string;
  amount: number;
  unethicalPractices?: string[]; // e.g. ["🏭 Factory Farming", "🌎 High Emissions"]
  ethicalPractices?: string[]; // e.g. ["🌱 Sustainable Sourcing"]
  practiceWeights?: Record<string, number>; // e.g. { "🏭 Factory Farming": 80, "🌱 Sustainable Sourcing": 20 }
  charities?: Record<string, { name: string; url: string }>;

  // Computed fields:
  societalDebt?: number;
  practiceDebts?: Record<string, number>;
}

interface OpenAIResponse {
  transactions: Transaction[];
  // summary: string;
  // spendingType: string;
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
  timeout: 120000, // 2 minutes
});

export async function POST(req: NextRequest) {
  try {
    // 1) Parse incoming JSON: the transactions the user wants analyzed
    const { transactions }: { transactions: Transaction[] } = await req.json();
    if (!Array.isArray(transactions)) {
      return NextResponse.json(
        { error: "Invalid transactions data" },
        { status: 400 }
      );
    }

    console.log("📡 Sending request to OpenAI...");

    const response = await openai.chat.completions.create({
      model: "o3-mini",
      messages: [
        {
          role: "system",
          content: `You are an AI that analyzes financial transactions to provide ethical insights.

          Rules:
          1) For each transaction, identify highly impactful ethical and unethical issues associated with the vendor.
          2) Assign a **percentage weight** (0-100) to each ethical and unethical **impact area** to represent a rought estimate of the percent of profits directed toward this **impact area**. 
            - Example: A fast food company may be **70% Factory Farming, 2% Community Support**.
            - The total percentages do **NOT** need to sum to 100 and should never exceed 100.
            - If the vendor barely profits from a **impact area**, assign a low percentage (e.g., Starbucks may have **10% Unsustainable Sourcing**).
            - If the vendor is entire revenue source depends on a **impact area**, assign a high percentage (e.g., an oil company may have **100% High Emissions**).
            - If the vendor name is ambiguouse, avoid making assumptions (e.g., "Local Market" may have **0% Factory Farming**).
            - Only include Impact Areas that have clear, substantial societal or environmental impacts.
            - Avoid low-impact or ambiguous issues (e.g., minor packaging details).
          3) **Do not assign contradictory **impact areas**** to the same vendor. For example:
            - ❌ Do not assign both "🌱 Sustainable Sourcing" and "🚚 Unsustainable Sourcing."
            - ❌ Avoid combinations like "🌎 Low Emissions" and "🚗 High Emissions."
            - ✅ Choose only the **most accurate** or **dominant** **impact area** of similar but opposite pairs.
          4) Link to the relevant charity navigator profile for each unethical **impact area**.
            - For ethical **Impact Areas**, put a cutesy emoji and a 2 word compliment in place of a charity.
            - Compliment the user instead for each ethical **impact area**.
            - The URL should be formatted as follows: https://www.charitynavigator.org/search?q=animal+welfare
          5) Describe the sufferring or relief caused by this  **impact area** in 7 words or less.
            - Optimize for empathy and education.

          Return only strict JSON, no extra disclaimers or markdown. The JSON must match exactly:

          {
            "transactions": [
              {
                "date": "YYYY-MM-DD",
                "name": "Merchant Name",
                "amount": 0.00,
                "unethicalPractices": ["🏭 Factory Farming"],
                "ethicalPractices": ["🌱 Sustainable Sourcing"],
                "practiceWeights": {
                  "🏭 Factory Farming": 80,
                  "🌱 Sustainable Sourcing": 5
                },
                "charities": {
                  "🏭 Factory Farming": { "name": "Animal Welfare", "url": "https://www.charitynavigator.org/discover-charities/cause-based-giving/animal-welfare-fund/" },
                "information": "Animals suffer, environments degrade, and diseases spread for corporate profit.}
                }
              }
            ],

            }`,
          // "summary": "1 - 2 sentences educating the user on their contributions to unethical practices.",
          // "spendingType": "A category based on the user's ethical weaknesses or strengths."
        },
        {
          role: "user",
          content: JSON.stringify({ transactions }),
        },
      ],
      // temperature: 0.5,
      // max_tokens: 2000,
    });

    console.log("🔍 OpenAI response received.");

    // 3) Extract the raw text from GPT
    const rawContent = response.choices[0]?.message?.content;
    console.log("🔑 Raw OpenAI response:", rawContent);

    if (!rawContent) {
      return NextResponse.json(
        { error: "OpenAI request failed. Please try again." },
        { status: 500 }
      );
    }

    // 4) Parse the JSON from GPT
    let analyzedData: OpenAIResponse;
    try {
      analyzedData = JSON.parse(rawContent) as OpenAIResponse;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_err) {
      return NextResponse.json(
        { error: "Invalid JSON from OpenAI", rawResponse: rawContent },
        { status: 500 }
      );
    }

    if (!analyzedData.transactions) {
      return NextResponse.json(
        { error: "No transactions in OpenAI response" },
        { status: 500 }
      );
    }

    console.log("📊 Processing transactions with practice weights...");

    // 5) For each transaction, compute the final "practiceDebts" using the weighted approach.
    const updatedTransactions = analyzedData.transactions.map((t) => {
      const practiceDebts: Record<string, number> = {};
      let newSocietalDebt = 0;

      // 5a) Unethical practices => always positive contributions
      t.unethicalPractices?.forEach((practice) => {
        const weight = t.practiceWeights?.[practice] ?? 100;
        const portion = t.amount * (weight / 100);
        practiceDebts[practice] = portion;
        newSocietalDebt += portion;
      });

      // 5b) Ethical practices => always negative contributions
      t.ethicalPractices?.forEach((practice) => {
        // Weighted approach. We use Math.abs(...) so we always reduce the debt
        // even if ethicsScore is negative
        const weight = t.practiceWeights?.[practice] ?? 100;
        const portion = t.amount * (weight / 100);
        practiceDebts[practice] = -portion;
        newSocietalDebt -= portion;

        // Optionally remove charities for ethical practices
        // delete t.charities?.[practice];
      });

      // Fallback if there were no practices
      const hasPractices =
        (t.unethicalPractices?.length || 0) + (t.ethicalPractices?.length || 0);
      if (!hasPractices) {
        // If no practices => do standard calculation or set to 0
        newSocietalDebt = 0;
      }

      return {
        ...t,
        societalDebt: newSocietalDebt,
        practiceDebts,
      };
    });

    // 6) Calculate totalSocietalDebt, totalSpent, and debtPercentage
    const totalSocietalDebt = updatedTransactions.reduce(
      (sum, tx) => sum + (tx.societalDebt ?? 0),
      0
    );
    const totalSpent = updatedTransactions.reduce(
      (sum, tx) => sum + (tx.amount ?? 0),
      0
    );
    const debtPercentage =
      totalSpent > 0 ? (totalSocietalDebt / totalSpent) * 100 : 0;

    console.log("✅ Returning updated transactions...");

    // 7) Return the final result
    return NextResponse.json({
      transactions: updatedTransactions,
      // summary: analyzedData.summary,
      // spendingType: analyzedData.spendingType,
      totalSocietalDebt,
      debtPercentage,
    });
  } catch (error) {
    console.error("❌ API Error:", error);
    return NextResponse.json(
      { error: "Internal server error. Please try again later." },
      { status: 500 }
    );
  }
}
