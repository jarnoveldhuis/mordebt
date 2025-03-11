// src/features/charity/DonationModal.tsx
"use client";

import { useState, useEffect } from "react";
import { CharitySearchResult, getRecommendedCharities } from "./charityService";
import { createDonationUrl } from "./charityService";
import { CharitySearch } from "./CharitySearch";
import { LoadingSpinner } from "@/shared/components/ui/LoadingSpinner";

interface DonationModalProps {
  practice: string;
  amount: number;
  charity?: {
    name: string;
    url: string;
  } | null;
  isOpen: boolean;
  onClose: () => void;
}

export function DonationModal({
  practice,
  amount,
  charity,
  isOpen,
  onClose,
}: DonationModalProps) {
  // Handle "All Societal Debt" special case
  const isAllSocietalDebt = practice === "All Societal Debt";
  const displayPractice = isAllSocietalDebt ? "Total Impact" : practice;
  
  // Initially no selected charity - we'll always load from recommendations
  const [selectedCharity, setSelectedCharity] = useState<CharitySearchResult | null>(null);
  
  const [donationAmount, setDonationAmount] = useState(Math.max(5, Math.round(amount)));
  const [showSearch, setShowSearch] = useState(false);
  const [recommendedCharities, setRecommendedCharities] = useState<CharitySearchResult[]>([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);

  // Fetch recommended charities when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchRecommendedCharities();
    }
  }, [isOpen, practice]);

  // Default charity for All Societal Debt
  useEffect(() => {
    if (isAllSocietalDebt && recommendedCharities.length > 0 && !selectedCharity) {
      // Select the first recommendation
      setSelectedCharity(recommendedCharities[0]);
    }
  }, [isAllSocietalDebt, recommendedCharities, selectedCharity]);

  // Fetch recommended charities for this practice
  const fetchRecommendedCharities = async () => {
    setLoadingRecommendations(true);
    try {
      const cleanPractice = practice
        .replace(/[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
        .trim();
        
      // For the "All Societal Debt" case, use "environment" as the search term
      // For practice-specific cases, use the cleaned practice name
      const searchTerm = isAllSocietalDebt ? "environment" : cleanPractice;
      
      console.log(`Fetching charities for: ${searchTerm}`);
      
      const charities = await getRecommendedCharities(searchTerm);
      setRecommendedCharities(charities);
      
      // If we got recommendations and don't have a selection yet, select the first one
      if (charities.length > 0 && !selectedCharity) {
        setSelectedCharity(charities[0]);
      }
    } catch (error) {
      console.error("Error fetching recommended charities:", error);
    } finally {
      setLoadingRecommendations(false);
    }
  };

  // Handle donation submission
  const handleDonate = () => {
    if (!selectedCharity) return;
    
    // Check if we have a donationUrl or need to create one
    let donationUrl;
    
    try {
      if (selectedCharity.donationUrl) {
        // Add parameters to existing URL
        const url = new URL(selectedCharity.donationUrl);
        url.searchParams.set('amount', Math.max(1, Math.round(donationAmount)).toString());
        url.searchParams.set('utm_source', 'mordebt-app');
        url.searchParams.set('utm_medium', 'web');
        if (practice) {
          url.searchParams.set('designation', practice);
        }
        donationUrl = url.toString();
      } else {
        // Get the ID from the charity - use slug if available, otherwise ein
        const charityIdentifier = selectedCharity.url?.split('/').pop() || selectedCharity.id;
        
        // Create new URL using the charity ID
        donationUrl = createDonationUrl(
          charityIdentifier, 
          donationAmount, 
          practice
        );
      }
    } catch (error) {
      console.error("Error creating donation URL:", error);
      // Fallback to a default URL
      const cleanPractice = practice.replace(/[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim();
      donationUrl = `https://www.every.org/donate?amount=${donationAmount}&utm_source=mordebt-app&designation=${encodeURIComponent(cleanPractice || "Societal Impact")}`;
    }
    
    console.log("Opening donation URL:", donationUrl);
    
    // Open donation URL in a new tab
    window.open(donationUrl, "_blank");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            Offset Your Impact: {displayPractice}
          </h2>
          
          <div className="mb-6">
            <p className="text-gray-700 mb-2">
              Your calculated impact:
            </p>
            <p className="text-2xl font-bold text-red-600">
              ${Math.abs(amount).toFixed(2)}
            </p>
          </div>
          
          {selectedCharity && !showSearch ? (
            <div className="mb-6 p-4 border border-gray-200 rounded">
              <h3 className="font-semibold text-blue-600">{selectedCharity.name}</h3>
              {selectedCharity.mission && (
                <p className="text-gray-600 text-sm mt-1 mb-2">{selectedCharity.mission}</p>
              )}
              <div className="mt-2 flex justify-end">
                <button
                  onClick={() => setShowSearch(true)}
                  className="text-blue-600 hover:text-blue-800 text-sm underline"
                >
                  Change Charity
                </button>
              </div>
            </div>
          ) : showSearch ? (
            <div className="mb-6">
              <CharitySearch
                practice={practice}
                onSelect={(charity) => {
                  setSelectedCharity(charity);
                  setShowSearch(false);
                }}
              />
              <button
                onClick={() => {
                  setShowSearch(false);
                  fetchRecommendedCharities();
                }}
                className="mt-2 text-blue-600 hover:text-blue-800 text-sm underline"
              >
                Back to recommendations
              </button>
            </div>
          ) : (
            <div className="mb-6">
              <h3 className="font-semibold text-gray-800 mb-3">Recommended Charities</h3>
              
              {loadingRecommendations ? (
                <LoadingSpinner message="Finding recommended charities..." />
              ) : recommendedCharities.length === 0 ? (
                <div className="text-center p-4">
                  <p className="text-gray-700 mb-2">No specific recommendations found.</p>
                  <button
                    onClick={() => setShowSearch(true)}
                    className="text-blue-600 hover:text-blue-800 underline"
                  >
                    Search for a charity
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {recommendedCharities.map((charity) => (
                    <div
                      key={charity.id}
                      className="border border-gray-200 rounded p-3 hover:bg-blue-50 cursor-pointer"
                      onClick={() => setSelectedCharity(charity)}
                    >
                      <div className="flex items-center">
                        {charity.logoUrl && (
                          <img
                            src={charity.logoUrl}
                            alt={`${charity.name} logo`}
                            className="w-10 h-10 object-contain mr-3"
                          />
                        )}
                        <div>
                          <h4 className="font-medium text-blue-700">{charity.name}</h4>
                          <p className="text-xs text-gray-700 truncate">{charity.mission}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  <div className="text-center pt-2">
                    <button
                      onClick={() => setShowSearch(true)}
                      className="text-blue-600 hover:text-blue-800 text-sm underline"
                    >
                      Search for more charities
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          
          <div className="mb-6">
            <label className="block text-gray-700 mb-2">Donation Amount</label>
            <div className="flex items-center">
              <span className="text-gray-700 text-lg mr-2">$</span>
              <input
                type="number"
                min="1"
                value={donationAmount}
                onChange={(e) => setDonationAmount(Number(e.target.value))}
                className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-800 font-medium"
              />
            </div>
          </div>
          
          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleDonate}
              disabled={!selectedCharity}
              className={`px-4 py-2 rounded-lg text-white ${
                selectedCharity
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-gray-400 cursor-not-allowed"
              }`}
            >
              Donate Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}