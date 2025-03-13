// src/features/analysis/transactionAnalysisService.ts
import OpenAI from "openai";
import { Transaction, AnalyzedTransactionData } from "./types";
import { transactionAnalysisPrompt } from "./prompts";
import { config } from "@/config";

interface OpenAIResponse {
  transactions: Transaction[];
}

/**
 * Core domain logic for analyzing transactions
 * This function should have no awareness of HTTP requests/responses
 */
export async function analyzeTransactionsCore(transactions: Transaction[]): Promise<AnalyzedTransactionData> {
  if (!Array.isArray(transactions) || transactions.length === 0) {
    throw new Error("Invalid transactions data");
  }

  // Skip any transactions that are already analyzed
  const transactionsToAnalyze = transactions.filter(tx => !tx.analyzed);
  
  if (transactionsToAnalyze.length === 0) {
    // If all transactions are already analyzed, just calculate totals
    return processAnalyzedTransactions(transactions);
  }

  const openai = new OpenAI({
    apiKey: config.openai.apiKey,
    timeout: config.openai.timeout,
  });

  console.log(`📡 Sending ${transactionsToAnalyze.length} transactions to OpenAI...`);

  const response = await openai.chat.completions.create({
    model: config.openai.model,
    messages: [
      {
        role: "system",
        content: transactionAnalysisPrompt,
      },
      {
        role: "user",
        content: JSON.stringify({ transactions: transactionsToAnalyze }),
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

  // Create a mapping of analyzed transactions by a unique identifier
  const analyzedTransactionMap = new Map<string, Transaction>();
  analyzedData.transactions.forEach(tx => {
    // Create a unique identifier based on date, name, and amount
    const identifier = `${tx.date}-${tx.name}-${tx.amount}`;
    analyzedTransactionMap.set(identifier, {
      ...tx,
      analyzed: true // Mark as analyzed
    });
  });

  // Merge with original transactions, preserving any that weren't sent for analysis
  const mergedTransactions = transactions.map(tx => {
    const identifier = `${tx.date}-${tx.name}-${tx.amount}`;
    if (analyzedTransactionMap.has(identifier)) {
      return analyzedTransactionMap.get(identifier)!;
    }
    return tx;
  });

  return processAnalyzedTransactions(mergedTransactions);
}

/**
 * Process the transactions returned from the AI
 * Apply business rules for calculating societal debt
 */
export function processAnalyzedTransactions(transactions: Transaction[]): AnalyzedTransactionData {
  // Process transactions with practice weights and search terms
  const updatedTransactions = transactions.map((t) => {
    // Skip processing if transaction is already fully processed
    if (t.societalDebt !== undefined && t.practiceDebts && Object.keys(t.practiceDebts).length > 0) {
      return t;
    }

    const practiceDebts: Record<string, number> = {};
    let newSocietalDebt = 0;

    // Ensure all necessary properties exist
    const unethicalPractices = t.unethicalPractices || [];
    const ethicalPractices = t.ethicalPractices || [];
    const practiceWeights = t.practiceWeights || {};
    const practiceSearchTerms = t.practiceSearchTerms || {};
    const information = t.information || {};

    // Build search terms if not provided by the API
    const builtSearchTerms: Record<string, string> = {...practiceSearchTerms};
    
    // Default search term mappings
    const defaultMappings: Record<string, string> = {
      "Factory Farming": "animal welfare",
      "High Emissions": "climate",
      "Environmental Degradation": "conservation",
      "Water Waste": "water conservation",
      "Resource Depletion": "sustainability",
      "Data Privacy Issues": "digital rights",
      "Labor Exploitation": "workers rights",
      "Excessive Packaging": "environment",
      "Animal Testing": "animal rights",
      "High Energy Usage": "renewable energy",
      "Content Diversity": "media diversity",
      "Sustainable Materials": "sustainability",
      "Ethical Investment": "ethical finance",
    };

    // Combine unethical and ethical practices for search term processing
    [...unethicalPractices, ...ethicalPractices].forEach(practice => {
      if (!builtSearchTerms[practice]) {
        builtSearchTerms[practice] = defaultMappings[practice] || practice.toLowerCase();
      }
    });

    // Unethical practices => always positive contributions (creating debt)
    unethicalPractices.forEach((practice) => {
      const weight = practiceWeights[practice] ?? 100;
      const portion = t.amount * (weight / 100);
      practiceDebts[practice] = portion; // Positive value = debt
      newSocietalDebt += portion;
    });

    // Ethical practices => always negative contributions (reducing debt)
    ethicalPractices.forEach((practice) => {
      const weight = practiceWeights[practice] ?? 100;
      const portion = -1 * (t.amount * (weight / 100)); // Make it negative
      practiceDebts[practice] = portion; // Negative value = credit
      newSocietalDebt += portion; // Add the negative value
    });

    // If no practices, set debt to 0
    if (unethicalPractices.length === 0 && ethicalPractices.length === 0) {
      newSocietalDebt = 0;
    }

    return {
      ...t,
      societalDebt: newSocietalDebt,
      practiceDebts,
      unethicalPractices,
      ethicalPractices,
      practiceWeights,
      practiceSearchTerms: builtSearchTerms,
      information,
      analyzed: true // Mark as analyzed
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