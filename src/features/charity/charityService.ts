// src/features/charity/charityService.ts

import { config } from "@/config";

// Helper function for logging
function logDebug(message: string, data?: unknown) {
  if (process.env.NODE_ENV === 'development' || process.env.DEBUG_CHARITY === 'true') {
    console.log(`[Charity Service] ${message}`, data || '');
  }
}

export interface CharitySearchResult {
  id: string;
  name: string;
  url: string;
  mission: string;
  category: string;
  logoUrl?: string;
  donationUrl?: string;
}

// Search for charities by cause or keyword
export async function searchCharities(query: string): Promise<CharitySearchResult[]> {
  try {
    logDebug(`Searching for charities with query: ${query}`);
    
    // Use our own API endpoint to avoid exposing API key in client code
    const response = await fetch(
      `/api/charity/search?query=${encodeURIComponent(query)}`
    );
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    logDebug(`Found ${data.charities?.length || 0} charities`);
    
    return data.charities || [];
  } catch (error) {
    console.error("Charity search error:", error);
    throw new Error("Failed to search charities");
  }
}

// Get charity details by ID
export async function getCharityById(id: string): Promise<CharitySearchResult | null> {
  try {
    // Use our own API endpoint to avoid exposing API key in client code
    const response = await fetch(
      `/api/charity/details?id=${encodeURIComponent(id)}`
    );
    
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.charity || null;
  } catch (error) {
    console.error("Charity details error:", error);
    throw new Error("Failed to get charity details");
  }
}

// Get recommended charities for a specific practice
export async function getRecommendedCharities(practice: string): Promise<CharitySearchResult[]> {
  try {
    const cleanPractice = practice
      .replace(/[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
      .trim();
      
    // For the "All Societal Debt" case, use "environment" as the search term
    // For practice-specific cases, use the cleaned practice name
    const searchTerm = cleanPractice === "All Societal Debt" ? "environment" : cleanPractice;
    
    logDebug(`Getting recommended charities for: ${searchTerm}`);
    
    // Use our API route to get recommendations
    const response = await fetch(
      `/api/charity/recommend?practice=${encodeURIComponent(practice)}`
    );
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.charities || [];
  } catch (error) {
    console.error("Charity recommendation error:", error);
    throw new Error("Failed to get recommended charities");
  }
}

// Create a donation URL for the given charity and amount
export function createDonationUrl(charityId: string, amount: number, cause?: string): string {
  // Check if this is an Ein (tax ID) or slug
  const isEin = /^\d{2}-\d{7}$/.test(charityId);
  
  // Format the URL differently based on if we have an EIN or a slug
  let baseUrl;
  if (isEin) {
    baseUrl = `https://www.every.org/ein/${charityId}/donate`;
  } else {
    // If it's not an EIN and looks like a slug, use it directly
    // Otherwise use the default donation page
    if (charityId && charityId !== 'everydotorg') {
      baseUrl = `https://www.every.org/${charityId}/donate`;
    } else {
      baseUrl = config.charity?.defaultDonationUrl || 'https://www.every.org/donate';
    }
  }
  
  // Add parameters
  const params = new URLSearchParams({
    amount: Math.max(1, Math.round(amount)).toString(),
    utm_source: "mordebt-app",
    utm_medium: "web"
  });
  
  if (cause) {
    params.append("designation", cause);
  }
  
  const finalUrl = `${baseUrl}?${params.toString()}`;
  logDebug(`Created donation URL: ${finalUrl} (charityId: ${charityId})`);
  
  return finalUrl;
}