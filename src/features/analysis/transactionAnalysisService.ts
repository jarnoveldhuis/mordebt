// src/features/analysis/transactionAnalysisService.ts
import OpenAI from "openai";
import { Transaction, AnalyzedTransactionData } from "./types";
import { transactionAnalysisPrompt } from "./prompts";
import { config } from "@/config";

interface OpenAIResponse {
  transactions: Transaction[];
}

interface CitationInfo {
  url: string;
  title: string;
  relevantPractice?: string;
}

/**
 * Stores URL citations extracted from OpenAI responses
 */
const extractedCitations: Record<string, string> = {};

/**
 * Process a transaction's information field to replace citation references with real URLs
 */
function processCitationReferences(
  information: Record<string, string>,
  annotations: any[] | undefined
): Record<string, string> {
  const processed: Record<string, string> = {};
  
  // Extract URLs from annotations if available
  const citationUrls: string[] = [];
  if (annotations) {
    annotations.forEach(a => {
      if (a.type === 'url_citation' && a.url_citation?.url) {
        citationUrls.push(a.url_citation.url);
      }
    });
  }
  
  // Process each information entry
  Object.entries(information).forEach(([key, value]) => {
    let processedValue = value;
    
    // Replace [CITATION:turn0search0] with real URLs when possible
    const turnSearchPattern = /\[CITATION:turn(\d+)search(\d+)\]/g;
    let i = 0;
    
    // Replace each citation reference
    processedValue = processedValue.replace(turnSearchPattern, (fullMatch) => {
      // Try to find a corresponding URL
      if (i < citationUrls.length) {
        const url = citationUrls[i++];
        // Save this mapping for future reference
        extractedCitations[fullMatch] = url;
        return `[Source](${url})`;
      }
      // If we don't have a URL, keep the original citation
      return fullMatch;
    });
    
    // Also check our previously extracted citations
    Object.entries(extractedCitations).forEach(([ref, url]) => {
      processedValue = processedValue.replace(ref, `[Source](${url})`);
    });
    
    processed[key] = processedValue;
  });
  
  return processed;
}

/**
 * Core domain logic for analyzing transactions
 * This function should have no awareness of HTTP requests/responses
 */
export async function analyzeTransactionsCore(
  transactions: Transaction[]
): Promise<AnalyzedTransactionData> {
  if (!Array.isArray(transactions) || transactions.length === 0) {
    throw new Error("Invalid transactions data");
  }

  // Skip any transactions that are already analyzed
  const transactionsToAnalyze = transactions.filter((tx) => !tx.analyzed);

  if (transactionsToAnalyze.length === 0) {
    // If all transactions are already analyzed, just calculate totals
    return processAnalyzedTransactions(transactions);
  }

  // Create OpenAI client with configured API key
  const openai = new OpenAI({
    apiKey: config.openai.apiKey,
    timeout: config.openai.timeout || 60000,
  });

  const isSearchEnabled = config.openai.model.includes("search");
  console.log(
    `📡 Sending ${
      transactionsToAnalyze.length
    } transactions to OpenAI using model: ${config.openai.model} (search ${
      isSearchEnabled ? "enabled" : "disabled"
    })`
  );

  let responseAnnotations: any[] | undefined;

  try {
    // Ensure we have valid transactions with required fields
    const sanitizedTransactions = transactionsToAnalyze.map((tx) => ({
      date: tx.date || new Date().toISOString().split("T")[0],
      name: tx.name || "Unknown Merchant",
      amount:
        typeof tx.amount === "number"
          ? tx.amount
          : parseFloat(String(tx.amount)) || 0,
      // Only include optional fields if they exist
      ...(tx.unethicalPractices
        ? { unethicalPractices: tx.unethicalPractices }
        : {}),
      ...(tx.ethicalPractices ? { ethicalPractices: tx.ethicalPractices } : {}),
      ...(tx.practiceWeights ? { practiceWeights: tx.practiceWeights } : {}),
      ...(tx.information ? { information: tx.information } : {}),
    }));

    // Prepare the prompt with instructions for handling web search
    const systemPrompt = `
${transactionAnalysisPrompt}

ADDITIONAL INSTRUCTIONS FOR WEB SEARCH CAPABILITY:
1. You may use web search to find the most up-to-date information about companies and business practices.
2. For each transaction, consider searching for recent information about the merchant's ethical practices.
3. Include any relevant web-based information in the "information" field for each practice.
4. For search results you reference, include a hidden URL in the information field using the format [CITATION:url].
5. Despite using web search, your output MUST still be valid JSON according to the required format.
6. Do not include any text or explanations outside of the JSON structure.
`;

    // Configure the API request differently based on model type
    let response;
    const citations: CitationInfo[] = [];

    if (isSearchEnabled) {
      // For search-enabled models, add web_search_options with appropriate settings
      response = await openai.chat.completions.create({
        model: config.openai.model,
        web_search_options: {
          search_context_size: config.openai.searchContextSize || "low",
        },
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: `Analyze these transactions and return valid JSON in the exact format requested.
For each merchant, try to find current information about their ethical practices and sustainability initiatives.
Include any relevant ethical information, but ensure your response is valid JSON.

${JSON.stringify({ transactions: sanitizedTransactions })}`,
          },
        ],
      });

      // Save annotations for later processing
      responseAnnotations = response.choices[0]?.message?.annotations;

      // Extract citations if available
      if (responseAnnotations) {
        responseAnnotations.forEach((annotation) => {
          if (annotation.type === "url_citation" && annotation.url_citation) {
            const { url, title, start_index, end_index } =
              annotation.url_citation;
            if (url && title) {
              // Try to extract which practice this citation is relevant to
              // by examining the text around the citation
              const messageContent =
                response.choices[0]?.message?.content || "";
              const surroundingText = messageContent.substring(
                Math.max(0, start_index - 100),
                Math.min(messageContent.length, end_index + 100)
              );

              // Look for practice names in surrounding text
              const commonPractices = [
                "Factory Farming",
                "High Emissions",
                "Environmental Degradation",
                "Labor Exploitation",
                "Water Waste",
                "Data Privacy Issues",
                "Excessive Packaging",
                "Animal Testing",
                "Resource Depletion",
              ];

              const relevantPractice = commonPractices.find((practice) =>
                surroundingText.includes(practice)
              );

              citations.push({
                url,
                title,
                relevantPractice,
              });
            }
          }
        });
      }

      console.log(
        `🔍 OpenAI search-enabled response received with ${citations.length} citations`
      );

      // Log raw response for debugging
      console.log(
        "Raw response content (first 500 chars):",
        (response.choices[0]?.message?.content || "").substring(0, 500)
      );
      // Extract the raw text from the response
      const rawContent = response.choices[0]?.message?.content;
      if (!rawContent) {
        throw new Error(
          "OpenAI request returned empty response. Please try again."
        );
      }

      // Create detailed logs of the raw content and response structure
      console.log("==== DETAILED RAW RESPONSE LOGS ====");
      console.log("Full raw content:", rawContent);

      // Log the annotations if they exist
      if (responseAnnotations) {
        console.log(
          "Response has annotations structure:",
          JSON.stringify(responseAnnotations, null, 2)
        );

        // Examine each annotation in detail
        responseAnnotations.forEach((annotation, index) => {
          console.log(
            `Annotation ${index}:`,
            JSON.stringify(annotation, null, 2)
          );

          if (annotation.type === "url_citation") {
            console.log(`Citation URL: ${annotation.url_citation?.url}`);
            console.log(`Citation title: ${annotation.url_citation?.title}`);

            // Extract and log the text being cited
            if (
              annotation.url_citation?.start_index !== undefined &&
              annotation.url_citation?.end_index !== undefined
            ) {
              const citedText = rawContent.substring(
                annotation.url_citation.start_index,
                annotation.url_citation.end_index
              );
              console.log(`Cited text: "${citedText}"`);
            }
          }
        });
      }

      // Inspect for any patterns that look like citations
      const citationPatterns = [
        /\[CITATION:([^\]]+)\]/g,
        /\[\^?(\d+)\]/g,
        /\(([^)]+)\)/g,
      ];

      citationPatterns.forEach((pattern) => {
        const matches = [...rawContent.matchAll(pattern)];
        if (matches.length > 0) {
          console.log(
            `Found ${matches.length} potential citations using pattern ${pattern}:`
          );
          matches.forEach((match) => {
            console.log(`- ${match[0]} (captured: ${match[1]})`);
          });
        }
      });

      // Also log any URLs found in the raw content
      const urlPattern = /(https?:\/\/[^\s"']+)/g;
      const urls = [...rawContent.matchAll(urlPattern)];
      if (urls.length > 0) {
        console.log(`Found ${urls.length} URLs in raw content:`);
        urls.forEach((url) => {
          console.log(`- ${url[0]}`);
        });
      }

      console.log("==== END DETAILED LOGS ====");

      // Now let's handle the citations differently
      // Look for the special [CITATION:turn0search1] format and try to extract real URLs

      // First, check if we have any turn/search references
      const turnSearchPattern = /\[CITATION:turn(\d+)search(\d+)\]/g;
      const turnSearchMatches = [...rawContent.matchAll(turnSearchPattern)];

      if (turnSearchMatches.length > 0) {
        console.log(`Found ${turnSearchMatches.length} turn/search references`);

        // If we have annotations, try to map them to the turn/search references
        if (responseAnnotations) {
          // Create a mapping between turn/search refs and actual URLs
          // This is imperfect but might help in some cases
          const urlsByIndex = responseAnnotations
            .filter((a) => a.type === "url_citation" && a.url_citation?.url)
            .map((a) => a.url_citation?.url);

          if (urlsByIndex.length > 0) {
            console.log(
              `Found ${urlsByIndex.length} URLs in annotations that might match references`
            );
            console.log(urlsByIndex);

            // We'll use this mapping later when processing the transactions
          }
        }
      }
    } else {
      // For standard models, use the regular approach
      response = await openai.chat.completions.create({
        model: config.openai.model,
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: JSON.stringify({ transactions: sanitizedTransactions }),
          },
        ],
      });

      // Save annotations (would be empty for non-search models)
      responseAnnotations = response.choices[0]?.message?.annotations;

      console.log("🔍 OpenAI standard response received");
    }

    // Extract the raw text from the response
    const rawContent = response.choices[0]?.message?.content;
    if (!rawContent) {
      throw new Error(
        "OpenAI request returned empty response. Please try again."
      );
    }

    // Log the raw response for debugging
    console.log("Raw response content:", rawContent);

    // Try to find JSON content in the response
    let jsonString = rawContent;

    // Look for JSON between backticks (```) or code blocks
    const jsonRegex = /```(?:json)?\s*([\s\S]*?)\s*```/;
    const jsonMatch = rawContent.match(jsonRegex);

    if (jsonMatch && jsonMatch[1]) {
      jsonString = jsonMatch[1];
      console.log("📋 Extracted JSON from code block");
    } else {
      // Try to find JSON between curly braces if not in code block
      const curlyBraceMatch = rawContent.match(/\{[\s\S]*\}/);
      if (curlyBraceMatch) {
        jsonString = curlyBraceMatch[0];
        console.log("📋 Extracted JSON using curly brace detection");
      }
    }

    // Parse the JSON from the extracted content
    let analyzedData: OpenAIResponse;
    try {
      analyzedData = JSON.parse(jsonString) as OpenAIResponse;
    } catch (err) {
      console.error("❌ JSON parsing error:", err);

      // Try to fix common JSON issues and try parsing again
      try {
        // Replace single quotes with double quotes
        const fixedJson = jsonString
          .replace(/'/g, '"') // Replace single quotes with double quotes
          .replace(/\n/g, " ") // Remove newlines
          .replace(/,\s*}/g, "}") // Remove trailing commas
          .replace(/,\s*]/g, "]") // Remove trailing commas in arrays
          .replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3'); // Add quotes around keys

        console.log(
          "🔧 Attempting to fix JSON:",
          fixedJson.substring(0, 500) + "..."
        );
        analyzedData = JSON.parse(fixedJson) as OpenAIResponse;
        console.log("✅ JSON fixed and parsed successfully");
      } catch (fixErr) {
        console.error("Failed to fix JSON:", fixErr);

        // If all else fails, return a minimal valid structure with the original transactions
        // marked as analyzed but without detailed analysis
        console.log("⚠️ Creating fallback analysis data");

        const fallbackTransactions = sanitizedTransactions.map((tx) => ({
          ...tx,
          societalDebt: 0,
          unethicalPractices: [],
          ethicalPractices: [],
          practiceWeights: {},
          information: {
            _error:
              "Failed to analyze this transaction due to API response format issues.",
          },
          analyzed: true,
        }));

        return processAnalyzedTransactions([
          ...transactions.filter((tx) => tx.analyzed),
          ...fallbackTransactions,
        ]);
      }
    }

    if (!analyzedData.transactions) {
      throw new Error("No transactions in OpenAI response");
    }

    // Process citations and add them to transaction information
    if (citations.length > 0) {
      console.log(`Processing ${citations.length} citations from web search`);

      citations.forEach((citation) => {
        // Find transactions that might be related to this citation
        if (citation.relevantPractice) {
          // Look for transactions with this practice
          analyzedData.transactions.forEach((tx) => {
            const hasRelevantPractice =
              (tx.unethicalPractices &&
                tx.unethicalPractices.includes(citation.relevantPractice!)) ||
              (tx.ethicalPractices &&
                tx.ethicalPractices.includes(citation.relevantPractice!));

            if (hasRelevantPractice) {
              // Add citation to information
              if (!tx.information) tx.information = {};

              if (tx.information[citation.relevantPractice!]) {
                // Append to existing information
                tx.information[
                  citation.relevantPractice!
                ] += ` [Source: ${citation.title}](${citation.url})`;
              } else {
                // Create new information with citation
                tx.information[
                  citation.relevantPractice!
                ] = `Information about ${citation.relevantPractice} [Source: ${citation.title}](${citation.url})`;
              }
            }
          });
        }
      });
    }

    // Process turn/search references in information fields
    analyzedData.transactions.forEach(tx => {
      if (tx.information) {
        // Use our citation processor
        tx.information = processCitationReferences(tx.information, responseAnnotations);
      }
    });

    // Create a mapping of analyzed transactions by a unique identifier
    const analyzedTransactionMap = new Map<string, Transaction>();
    analyzedData.transactions.forEach((tx) => {
      // Create a unique identifier based on date, name, and amount
      const identifier = `${tx.date}-${tx.name}-${tx.amount}`;
      analyzedTransactionMap.set(identifier, {
        ...tx,
        analyzed: true, // Mark as analyzed
      });
    });

    // Merge with original transactions, preserving any that weren't sent for analysis
    const mergedTransactions = transactions.map((tx) => {
      const identifier = `${tx.date}-${tx.name}-${tx.amount}`;
      if (analyzedTransactionMap.has(identifier)) {
        return analyzedTransactionMap.get(identifier)!;
      }
      return tx;
    });

    return processAnalyzedTransactions(mergedTransactions);
  } catch (error) {
    console.error("OpenAI API error:", error);

    // Create a more user-friendly error message
    let errorMessage = "Failed to analyze transactions";

    if (error instanceof Error) {
      // Check for common API errors
      if (error.message.includes("API key")) {
        errorMessage =
          "OpenAI API key error. Please check your API key configuration.";
      } else if (error.message.includes("timeout")) {
        errorMessage =
          "OpenAI request timed out. Please try again with fewer transactions.";
      } else if (error.message.includes("rate limit")) {
        errorMessage =
          "OpenAI rate limit exceeded. Please wait a moment and try again.";
      } else {
        errorMessage = `Analysis error: ${error.message}`;
      }
    }

    throw new Error(errorMessage);
  }
}

/**
 * Process the transactions returned from the AI
 * Apply business rules for calculating societal debt
 */
export function processAnalyzedTransactions(
  transactions: Transaction[]
): AnalyzedTransactionData {
  // Process transactions with practice weights and search terms
  const updatedTransactions = transactions.map((t) => {
    // Skip processing if transaction is already fully processed
    if (
      t.societalDebt !== undefined &&
      t.practiceDebts &&
      Object.keys(t.practiceDebts).length > 0
    ) {
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
    const builtSearchTerms: Record<string, string> = { ...practiceSearchTerms };

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
    [...unethicalPractices, ...ethicalPractices].forEach((practice) => {
      if (!builtSearchTerms[practice]) {
        builtSearchTerms[practice] =
          defaultMappings[practice] || practice.toLowerCase();
      }
    });

    // Process any embedded citation links in information field
    const processedInformation: Record<string, string> = {};
    Object.entries(information).forEach(([key, value]) => {
      // Replace any [CITATION:url] with markdown links
      const processedValue = value.replace(
        /\[CITATION:(https?:\/\/[^\]]+)\]/g,
        (match, url) => `[Source](${url})`
      );
      processedInformation[key] = processedValue;
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
      information: processedInformation,
      analyzed: true, // Mark as analyzed
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
  const debtPercentage =
    totalSpent > 0 ? (totalSocietalDebt / totalSpent) * 100 : 0;

  return {
    transactions: updatedTransactions,
    totalSocietalDebt,
    debtPercentage,
  };
}