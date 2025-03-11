// src/features/charity/CharitySearch.tsx
"use client";

import { useState, useEffect } from "react";
import { searchCharities, CharitySearchResult } from "./charityService";
import { LoadingSpinner } from "@/shared/components/ui/LoadingSpinner";

interface CharitySearchProps {
  practice: string;
  onSelect: (charity: CharitySearchResult) => void;
}

export function CharitySearch({ practice, onSelect }: CharitySearchProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<CharitySearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize search term based on practice
  useEffect(() => {
    // Clean up practice name by removing emojis and extra spaces
    const cleanedPractice = practice
      .replace(/[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "")
      .trim();
    
    // Special cases
    if (cleanedPractice === "All Societal Debt") {
      setSearchTerm("environment"); // Default to environment for general offset
    } else {
      setSearchTerm(cleanedPractice);
    }
  }, [practice]);

  // Search for charities when search term changes
  useEffect(() => {
    if (!searchTerm) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await searchCharities(searchTerm);
        setResults(data);
      } catch (err) {
        console.error("Search error:", err);
        setError("Failed to search charities. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    // Use a debounce to avoid too many API calls
    const timer = setTimeout(() => {
      fetchData();
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  return (
    <div className="w-full p-4 bg-white rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">Find a Charity for {practice}</h3>
      
      <div className="mb-4">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search for charities..."
          className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>

      {loading ? (
        <LoadingSpinner message="Searching charities..." />
      ) : error ? (
        <div className="text-red-500 p-3">{error}</div>
      ) : (
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {results.length === 0 ? (
            <p className="text-gray-500 text-center py-4">
              {searchTerm ? "No charities found. Try a different search term." : "Enter a search term to find charities."}
            </p>
          ) : (
            results.map((charity) => (
              <div
                key={charity.id}
                className="border border-gray-200 rounded p-3 hover:bg-blue-50 cursor-pointer"
                onClick={() => onSelect(charity)}
              >
                <div className="flex items-center">
                  {charity.logoUrl && (
                    <img
                      src={charity.logoUrl}
                      alt={`${charity.name} logo`}
                      className="w-12 h-12 object-contain mr-3"
                    />
                  )}
                  <div>
                    <h4 className="font-medium text-blue-600">{charity.name}</h4>
                    <p className="text-sm text-gray-600 truncate">{charity.mission}</p>
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                      {charity.category}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}