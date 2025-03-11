// src/features/charity/charityService.ts

import { config } from "@/config";

// Helper function for logging
function logDebug(message: string, data?: any) {
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