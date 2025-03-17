// src/features/banking/PlaidConnectionSection.tsx
import { useState } from 'react';
import PlaidLink from "@/features/banking/PlaidLink";
import { useSampleData } from '@/features/debug/useSampleData';
import { config } from '@/config';

// Determine if we're in development/sandbox mode
const isSandboxMode = process.env.NODE_ENV === 'development' || config.plaid.isSandbox;

interface PlaidConnectionSectionProps {
  onSuccess: (public_token: string | null) => void;
  isConnected: boolean;
}

export function PlaidConnectionSection({ 
  onSuccess, 
  isConnected 
}: PlaidConnectionSectionProps) {
  const [showSampleOption, setShowSampleOption] = useState(isSandboxMode);
  const { generateSampleTransactions } = useSampleData();

  // Sample data handler for development
  const handleUseSampleData = () => {
    // Generate sample transactions directly
    const sampleTransactions = generateSampleTransactions();
    
    // Call onSuccess with null to indicate we're not using Plaid
    // The parent component should detect this and use the sample data
    onSuccess(null);
    
    // This is where you would call a function to load the sample data
    // In the real implementation, you should have a way to pass these
    // transactions to your analysis service
    console.log("Sample data loaded:", sampleTransactions);
  };

  if (isConnected) {
    return (
      <div className="flex flex-col items-center">
        <span className="bg-green-100 text-green-800 text-sm px-3 py-1 rounded-full">
          ✓ Bank account connected
        </span>
        <span className="text-xs text-gray-500 mt-1">
          Use the Disconnect Bank button in the header to connect to a different bank
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center space-y-3">
      <PlaidLink onSuccess={onSuccess} />
      
      {/* Sample data option for development */}
      {showSampleOption && (
        <div className="mt-4">
          <div className="text-center">
            <div className="text-xs text-gray-500 mb-2">- OR -</div>
            <button
              onClick={handleUseSampleData}
              className="text-blue-600 hover:text-blue-800 text-sm underline"
            >
              Use Sample Data (Development Only)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}