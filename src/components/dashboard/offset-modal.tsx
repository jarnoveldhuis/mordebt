import React, { useState, useEffect, useCallback } from 'react';
import { CharitySearchResult } from '@/features/charity/charityService';
import { LoadingSpinner } from '@/shared/components/ui/LoadingSpinner';
import Image from 'next/image';

interface OffsetModalProps {
  practice: string;
  amount: number;
  isOpen: boolean;
  onClose: () => void;
  onDonate?: (charityId: string, amount: number) => void;
}

const OffsetModal: React.FC<OffsetModalProps> = ({
  practice,
  amount,
  isOpen,
  onClose,
  onDonate
}) => {
  const [selectedCharity, setSelectedCharity] = useState<CharitySearchResult | null>(null);
  const [donationAmount, setDonationAmount] = useState<number>(Math.max(5, Math.round(amount)));
  const [recommendedCharities, setRecommendedCharities] = useState<CharitySearchResult[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showSearch, setShowSearch] = useState<boolean>(false);

  // Define fetchRecommendedCharities with useCallback
  const fetchRecommendedCharities = useCallback(async () => {
    setIsLoading(true);
    
    try {
      // In a real app, this would call your API endpoint
      const response = await fetch(`/api/charity/recommend?practice=${encodeURIComponent(practice)}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch charities: ${response.status}`);
      }
      
      const data = await response.json();
      setRecommendedCharities(data.charities || []);
    } catch (error) {
      console.error('Error fetching recommended charities:', error);
      // Fallback data for demo purposes
      setRecommendedCharities([
        {
          id: "1",
          name: "Climate Action Fund",
          url: "https://example.org/climate",
          mission: "Working to reduce carbon emissions and fight climate change through policy and direct action.",
          category: "Environment",
          logoUrl: "https://example.org/logo1.png"
        },
        {
          id: "2",
          name: "Fair Trade Coalition",
          url: "https://example.org/fairtrade",
          mission: "Supporting fair wages and ethical working conditions for producers worldwide.",
          category: "Social Justice", 
          logoUrl: "https://example.org/logo2.png"
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [practice]);  // Add practice as a dependency

  // Fetch recommended charities on mount
  useEffect(() => {
    if (isOpen) {
      fetchRecommendedCharities();
    }
  }, [isOpen, fetchRecommendedCharities]);  // Now fetchRecommendedCharities is a dependency

  // Set default charity when recommendations load
  useEffect(() => {
    if (recommendedCharities.length > 0 && !selectedCharity) {
      setSelectedCharity(recommendedCharities[0]);
    }
  }, [recommendedCharities, selectedCharity]);

  const handleDonate = () => {
    if (!selectedCharity) return;
    
    // Get charity ID from the URL or the ID field
    const charityId = selectedCharity.id || 
                      selectedCharity.url?.split('/').pop() || 
                      'charity';
    
    if (onDonate) {
      onDonate(charityId, donationAmount);
    } else {
      // Default behavior - open donation URL
      const donationUrl = selectedCharity.donationUrl || `https://www.every.org/${charityId}/donate?amount=${donationAmount}`;
      window.open(donationUrl, "_blank");
    }
    
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            Offset Your Impact: {practice}
          </h2>
          
          <div className="mb-6">
            <p className="text-gray-700 mb-2">
              Your calculated impact:
            </p>
            <p className="text-2xl font-bold text-red-600">
              ${Math.abs(amount).toFixed(2)}
            </p>
          </div>
          
          {isLoading ? (
            <div className="mb-6 p-4 border border-gray-200 rounded">
              <LoadingSpinner message="Finding recommended charities..." />
            </div>
          ) : selectedCharity && !showSearch ? (
            <div className="mb-6 p-4 border border-gray-200 rounded">
              <h3 className="font-semibold text-blue-600">{selectedCharity.name}</h3>
              {selectedCharity.mission && (
                <p className="text-gray-600 text-sm mt-1 mb-2">{selectedCharity.mission}</p>
              )}
              <div className="flex items-center mt-3">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                  {selectedCharity.logoUrl ? (
                    <Image 
                      src={selectedCharity.logoUrl} 
                      alt={selectedCharity.name} 
                      className="w-10 h-10 rounded-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = ""; // Remove source to show fallback
                        target.style.display = "none"; // Hide the image
                      }}
                    />
                  ) : (
                    <span className="text-blue-800 font-bold">{selectedCharity.name.charAt(0)}</span>
                  )}
                </div>
                <div className="text-sm">
                  <span className="text-gray-500">Category:</span>{" "}
                  <span className="font-medium">{selectedCharity.category || "Charity"}</span>
                </div>
              </div>
              <div className="mt-2 flex justify-end">
                <button
                  onClick={() => setShowSearch(true)}
                  className="text-blue-600 hover:text-blue-800 text-sm"
                >
                  Change Charity
                </button>
              </div>
            </div>
          ) : showSearch ? (
            <div className="mb-6">
              <div className="p-4 border border-gray-200 rounded">
                <h3 className="font-medium text-gray-800 mb-2">Search for a Charity</h3>
                <input 
                  type="text"
                  placeholder="Search charities..."
                  className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <div className="mt-3">
                  <button
                    onClick={() => {
                      setShowSearch(false);
                      fetchRecommendedCharities();
                    }}
                    className="text-blue-600 hover:text-blue-800 text-sm"
                  >
                    Back to recommendations
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="mb-6">
              <h3 className="font-semibold text-gray-800 mb-3">Recommended Charities</h3>
              
              {recommendedCharities.length === 0 ? (
                <div className="text-center p-4">
                  <p className="text-gray-700 mb-2">No specific recommendations found.</p>
                  <button
                    onClick={() => setShowSearch(true)}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    Search for a charity
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {recommendedCharities.map((charity) => (
                    <div
                      key={charity.id || charity.name}
                      className="border border-gray-200 rounded p-3 hover:bg-blue-50 cursor-pointer transition-colors"
                      onClick={() => setSelectedCharity(charity)}
                    >
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                          {charity.logoUrl ? (
                            <span className="relative w-8 h-8">
                              <Image 
                                src={charity.logoUrl} 
                                alt={charity.name} 
                                className="w-8 h-8 rounded-full object-cover"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.src = ""; 
                                  target.style.display = "none";
                                }}
                              />
                            </span>
                          ) : (
                            <span className="text-blue-800 font-bold">{charity.name.charAt(0)}</span>
                          )}
                        </div>
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
                      className="text-blue-600 hover:text-blue-800 text-sm"
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
              className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDonate}
              disabled={!selectedCharity}
              className={`px-4 py-2 rounded-lg text-white transition-colors ${
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
};

export default OffsetModal;