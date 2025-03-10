// src/app/api/analyze/route.ts

import { NextRequest, NextResponse } from "next/server";
import { analyzeTransactions } from "@/lib/openai/analyzeTransactions";

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


// import { NextRequest, NextResponse } from "next/server";
// import OpenAI from "openai";
// import { transactionAnalysisPrompt } from '@/lib/openai/prompts';

// interface Transaction {
//   date: string;
//   name: string;
//   amount: number;
//   unethicalPractices?: string[]; // e.g. ["🏭 Factory Farming", "🌎 High Emissions"]
//   ethicalPractices?: string[]; // e.g. ["🌱 Sustainable Sourcing"]
//   practiceWeights?: Record<string, number>; // e.g. { "🏭 Factory Farming": 80, "🌱 Sustainable Sourcing": 20 }
//   charities?: Record<string, { name: string; url: string }>;

//   // Computed fields:
//   societalDebt?: number;
//   practiceDebts?: Record<string, number>;
// }

// interface OpenAIResponse {
//   transactions: Transaction[];
//   // summary: string;
//   // spendingType: string;
// }

// const openai = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY!,
//   timeout: 120000, // 2 minutes
// });

// export async function POST(req: NextRequest) {
//   try {
//     // 1) Parse incoming JSON: the transactions the user wants analyzed
//     const { transactions }: { transactions: Transaction[] } = await req.json();
//     if (!Array.isArray(transactions)) {
//       return NextResponse.json(
//         { error: "Invalid transactions data" },
//         { status: 400 }
//       );
//     }

//     console.log("📡 Sending request to OpenAI...");

//     const response = await openai.chat.completions.create({
//       model: "o3-mini",
//       messages: [
//         {
//           role: "system",
//           content: transactionAnalysisPrompt,
//         },
//         {
//           role: "user",
//           content: JSON.stringify({ transactions }),
//         },
//       ],
//       // temperature: 0.5,
//       // max_tokens: 2000,
//     });

//     console.log("🔍 OpenAI response received.");

//     // 3) Extract the raw text from GPT
//     const rawContent = response.choices[0]?.message?.content;
//     console.log("🔑 Raw OpenAI response:", rawContent);

//     if (!rawContent) {
//       return NextResponse.json(
//         { error: "OpenAI request failed. Please try again." },
//         { status: 500 }
//       );
//     }

//     // 4) Parse the JSON from GPT
//     let analyzedData: OpenAIResponse;
//     try {
//       analyzedData = JSON.parse(rawContent) as OpenAIResponse;
//       // eslint-disable-next-line @typescript-eslint/no-unused-vars
//     } catch (_err) {
//       return NextResponse.json(
//         { error: "Invalid JSON from OpenAI", rawResponse: rawContent },
//         { status: 500 }
//       );
//     }

//     if (!analyzedData.transactions) {
//       return NextResponse.json(
//         { error: "No transactions in OpenAI response" },
//         { status: 500 }
//       );
//     }

//     console.log("📊 Processing transactions with practice weights...");

//     // 5) For each transaction, compute the final "practiceDebts" using the weighted approach.
//     const updatedTransactions = analyzedData.transactions.map((t) => {
//       const practiceDebts: Record<string, number> = {};
//       let newSocietalDebt = 0;

//       // 5a) Unethical practices => always positive contributions
//       t.unethicalPractices?.forEach((practice) => {
//         const weight = t.practiceWeights?.[practice] ?? 100;
//         const portion = t.amount * (weight / 100);
//         practiceDebts[practice] = portion;
//         newSocietalDebt += portion;
//       });

//       // 5b) Ethical practices => always negative contributions
//       t.ethicalPractices?.forEach((practice) => {
//         // Weighted approach. We use Math.abs(...) so we always reduce the debt
//         // even if ethicsScore is negative
//         const weight = t.practiceWeights?.[practice] ?? 100;
//         const portion = t.amount * (weight / 100);
//         practiceDebts[practice] = -portion;
//         newSocietalDebt -= portion;

//         // Optionally remove charities for ethical practices
//         // delete t.charities?.[practice];
//       });

//       // Fallback if there were no practices
//       const hasPractices =
//         (t.unethicalPractices?.length || 0) + (t.ethicalPractices?.length || 0);
//       if (!hasPractices) {
//         // If no practices => do standard calculation or set to 0
//         newSocietalDebt = 0;
//       }

//       return {
//         ...t,
//         societalDebt: newSocietalDebt,
//         practiceDebts,
//       };
//     });

//     // 6) Calculate totalSocietalDebt, totalSpent, and debtPercentage
//     const totalSocietalDebt = updatedTransactions.reduce(
//       (sum, tx) => sum + (tx.societalDebt ?? 0),
//       0
//     );
//     const totalSpent = updatedTransactions.reduce(
//       (sum, tx) => sum + (tx.amount ?? 0),
//       0
//     );
//     const debtPercentage =
//       totalSpent > 0 ? (totalSocietalDebt / totalSpent) * 100 : 0;

//     console.log("✅ Returning updated transactions...");

//     // 7) Return the final result
//     return NextResponse.json({
//       transactions: updatedTransactions,
//       // summary: analyzedData.summary,
//       // spendingType: analyzedData.spendingType,
//       totalSocietalDebt,
//       debtPercentage,
//     });
//   } catch (error) {
//     console.error("❌ API Error:", error);
//     return NextResponse.json(
//       { error: "Internal server error. Please try again later." },
//       { status: 500 }
//     );
//   }
// }
