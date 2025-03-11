// src/app/api/charity/recommend/route.ts
import { NextRequest, NextResponse } from "next/server";
import { config } from "@/config";

export async function GET(request: NextRequest) {
  try {
    // Get practice from URL parameters
    const searchParams = request.nextUrl.searchParams;
    const practice = searchParams.get("practice");
    
    if (!practice) {
      return NextResponse.json(
        { error: "Missing practice parameter" },
        { status: 400 }
      );
    }
    
    // Map common practices to relevant search terms
    const searchTermMap: Record<string, string> = {
      // Unethical practices and their charity categories
      "🏭 Factory Farming": "animal welfare",
      "Factory Farming": "animal welfare",
      "📦 Excessive Packaging": "environment",
      "Excessive Packaging": "environment",
      "👷 Labor Exploitation": "fair trade",
      "Labor Exploitation": "fair trade",
      "🏭 High Emissions": "climate",
      "High Emissions": "climate",
      "🌍 Environmental Degradation": "conservation",
      "Environmental Degradation": "conservation",
      "🐇 Animal Testing": "animal rights",
      "Animal Testing": "animal rights",
      "💧 Water Waste": "water conservation",
      "Water Waste": "water conservation",
      "🌳 Resource Depletion": "sustainability",
      "Resource Depletion": "sustainability",
      "🔒 Data Privacy Issues": "digital rights",
      "Data Privacy Issues": "digital rights",
      "⚡ High Energy Usage": "renewable energy",
      "High Energy Usage": "renewable energy",
      
      // Special cases
      "All Societal Debt": "climate",
      
      // Default to the practice name if no mapping exists
      "Default": practice.replace(/[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim()
    };
    
    // Get the appropriate search term
    let searchTerm = searchTermMap[practice] || searchTermMap["Default"];
    
    // If search term is empty after cleaning, use a generic term
    if (!searchTerm) {
      searchTerm = "charity";
    }
    
    console.log(`Charity recommendation for practice "${practice}" using search term "${searchTerm}"`);
    
    try {
      // Call the Every.org API
      const response = await fetch(
        `${config.charity.baseUrl}/search/${encodeURIComponent(searchTerm)}?apiKey=${config.charity.apiKey}&take=5`
      );
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      // Try to get text first to log in case of parsing error
      const responseText = await response.text();
      
      try {
        // Parse JSON
        const data = JSON.parse(responseText);
        
        // Transform the response to our desired format
        const charities = data.nonprofits?.map((charity: any) => ({
          id: charity.ein || charity.id,
          name: charity.name,
          url: charity.profileUrl || `https://www.every.org/${charity.slug}`,
          mission: charity.description || "No description available",
          category: charity.tags?.[0] || "Charity",
          logoUrl: charity.logoUrl,
          donationUrl: charity.profileUrl ? `${charity.profileUrl}/donate` : null
        })) || [];
        
        return NextResponse.json({ 
          practice,
          searchTerm,
          charities 
        });
      } catch (parseError) {
        console.error("Failed to parse API response:", parseError);
        console.error("Response text:", responseText.substring(0, 200) + "...");
        throw new Error("Invalid response from charity API");
      }
    } catch (apiError) {
      console.error("API request failed:", apiError);
      // Return empty results instead of error
      return NextResponse.json({ 
        practice,
        searchTerm,
        charities: []
      });
    }
  } catch (error) {
    console.error("Charity recommendation error:", error);
    return NextResponse.json({ 
      practice: practice || "Unknown",
      charities: []
    }, { status: 200 });
  }
}