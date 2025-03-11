// src/app/api/charity/search/route.ts
import { NextRequest, NextResponse } from "next/server";
import { config } from "@/config";

interface EveryOrgNonprofit {
  ein?: string;
  id?: string;
  name: string;
  profileUrl?: string;
  slug?: string;
  description?: string;
  tags?: string[];
  logoUrl?: string;
}

interface EveryOrgResponse {
  nonprofits?: EveryOrgNonprofit[];
}

export async function GET(request: NextRequest) {
  try {
    // Get search query from URL parameters
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("query");
    
    if (!query) {
      return NextResponse.json(
        { error: "Missing search query" },
        { status: 400 }
      );
    }
    
    // Clean query - remove emojis and trim whitespace
    const cleanQuery = query
      .replace(/[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
      .trim();
      
    if (!cleanQuery) {
      // If query is empty after cleaning, return empty results instead of error
      return NextResponse.json({ charities: [] });
    }
    
    console.log(`Charity search for: "${cleanQuery}"`);
    
    try {
      // Call the Every.org API
      const response = await fetch(
        `${config.charity.baseUrl}/search/${encodeURIComponent(cleanQuery)}?apiKey=${config.charity.apiKey}&take=10`
      );
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      // Try to get text first to log in case of parsing error
      const responseText = await response.text();
      
      try {
        // Parse JSON
        const data = JSON.parse(responseText) as EveryOrgResponse;
        
        // Transform the response to our desired format
        const charities = data.nonprofits?.map((charity: EveryOrgNonprofit) => ({
          id: charity.ein || charity.id || "",
          name: charity.name,
          url: charity.profileUrl || `https://www.every.org/${charity.slug}`,
          mission: charity.description || "No description available",
          category: charity.tags?.[0] || "Charity",
          logoUrl: charity.logoUrl,
          donationUrl: charity.profileUrl ? `${charity.profileUrl}/donate` : null
        })) || [];
        
        return NextResponse.json({ charities });
      } catch (parseError) {
        console.error("Failed to parse API response:", parseError);
        console.error("Response text:", responseText.substring(0, 200) + "...");
        throw new Error("Invalid response from charity API");
      }
    } catch (apiError) {
      console.error("API request failed:", apiError);
      // Return empty results instead of error
      return NextResponse.json({ charities: [] });
    }
  } catch (error) {
    console.error("Charity search error:", error);
    // Return empty results as a fallback
    return NextResponse.json({ charities: [] }, { status: 200 });
  }
}