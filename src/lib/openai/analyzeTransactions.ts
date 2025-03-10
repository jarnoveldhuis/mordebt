import OpenAI from "openai";
import { Transaction } from "@/types/transactions";
import { transactionAnalysisPrompt } from "./prompts";
import { config } from "@/config";

interface OpenAIResponse {
  transactions: Transaction[];
}

export async function analyzeTransactions(transactions: Transaction[]) {
  if (!Array.isArray(transactions) || transactions.length === 0) {
    throw new Error("Invalid transactions data");
  }

  const openai = new OpenAI({
    apiKey: config.openai.apiKey,
    timeout: config.openai.timeout,
  });

  console.log("📡 Sending request to OpenAI...");

  const response = await openai.chat.completions.create({
    model: config.openai.model,
    messages: [
      {
        role: "system",
        content: transactionAnalysisPrompt,
      },
      {
        role: "user",
        content: JSON.stringify({ transactions }),
      },
    ],
  });

  console.log("🔍 OpenAI response received.");

  // Extract the raw text from GPT
  const rawContent = response.choices[0]?.message?.content;
  if (!rawContent) {
    throw new Error("OpenAI request failed. Please try again.");
  }

  // Parse the JSON from GPT
  let analyzedData: OpenAIResponse;
  try {
    analyzedData = JSON.parse(rawContent) as OpenAIResponse;
  } catch (err) {
    console.error("❌ JSON parsing error:", err);
    throw new Error("Invalid JSON from OpenAI");
  }

  if (!analyzedData.transactions) {
    throw new Error("No transactions in OpenAI response");
  }

  // Process transactions with practice weights
  const updatedTransactions = analyzedData.transactions.map((t) => {
    const practiceDebts: Record<string, number> = {};
    let newSocietalDebt = 0;

    // Unethical practices => always positive contributions
    t.unethicalPractices?.forEach((practice) => {
      const weight = t.practiceWeights?.[practice] ?? 100;
      const portion = t.amount * (weight / 100);
      practiceDebts[practice] = portion;
      newSocietalDebt += portion;
    });

    // Ethical practices => always negative contributions
    t.ethicalPractices?.forEach((practice) => {
      const weight = t.practiceWeights?.[practice] ?? 100;
      const portion = t.amount * (weight / 100);
      practiceDebts[practice] = -portion;
      newSocietalDebt -= portion;
    });

    // Fallback if there were no practices
    const hasPractices =
      (t.unethicalPractices?.length || 0) + (t.ethicalPractices?.length || 0);
    if (!hasPractices) {
      newSocietalDebt = 0;
    }

    return {
      ...t,
      societalDebt: newSocietalDebt,
      practiceDebts,
    };
  });

  // Calculate metrics
  const totalSocietalDebt = updatedTransactions.reduce(
    (sum, tx) => sum + (tx.societalDebt ?? 0),
    0
  );
  const totalSpent = updatedTransactions.reduce(
    (sum, tx) => sum + (tx.amount ?? 0),
    0
  );
  const debtPercentage = totalSpent > 0 ? (totalSocietalDebt / totalSpent) * 100 : 0;

  return {
    transactions: updatedTransactions,
    totalSocietalDebt,
    debtPercentage,
  };
}