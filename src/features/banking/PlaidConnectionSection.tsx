// src/app/api/banking/PlaidConnectionSection.tsx
import PlaidLink from "@/features/banking/PlaidLink";

interface PlaidConnectionSectionProps {
  onSuccess: (public_token: string | null) => void;
  isConnected: boolean;
}

export function PlaidConnectionSection({ 
  onSuccess, 
  isConnected 
}: PlaidConnectionSectionProps) {
  return (
    <div className="flex flex-col items-center space-y-3">
      {!isConnected ? (
        <PlaidLink onSuccess={onSuccess} />
      ) : (
        <div className="flex flex-col items-center">
          <span className="bg-green-100 text-green-800 text-sm px-3 py-1 rounded-full">
            ✓ Bank account connected
          </span>
          <span className="text-xs text-gray-500 mt-1">
            Use the "&quot;Disconnect Bank"&quot; button in the header to connect to a different bank
          </span>
        </div>
      )}
    </div>
  );
}