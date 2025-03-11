// src/app/api/charity/details/route.ts
import { NextRequest, NextResponse } from "next/server";
import { config } from "@/config";

export async function GET(request: NextRequest) {
  try {
    // Get charity ID from URL parameters
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get("id");
    
    if (!id) {
      return NextResponse.json(
        { error: "Missing charity ID" },
        { status: 400 }
      );
    }
    
    // Call the Every.org API
    const response = await fetch(
      `${config.charity.baseUrl}/nonprofit/${id}?apiKey=${config.charity.apiKey}`
    );
    
    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: "Charity not found" },
          { status: 404 }
        );
      }
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    const charity = data.nonprofit;
    
    // Transform the response to our desired format
    const charityDetails = {
      id: charity.ein || charity.id,
      name: charity.name,
      url: charity.profileUrl || `https://www.every.org/${charity.slug}`,
      mission: charity.description || "No description available",
      category: charity.tags?.[0] || "Charity",
      logoUrl: charity.logoUrl,
      donationUrl: charity.profileUrl ? `${charity.profileUrl}/donate` : null
    };
    
    return NextResponse.json({ charity: charityDetails });
  } catch (error) {
    console.error("Charity details error:", error);
    return NextResponse.json(
      { error: "Failed to get charity details" },
      { status: 500 }
    );
  }
}