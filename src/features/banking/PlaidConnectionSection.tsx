// src/features/banking/PlaidConnectionSection.tsx
import { useState, useEffect } from 'react';
import PlaidLink from "@/features/banking/PlaidLink";

interface PlaidConnectionSectionProps {
  onSuccess: (publicToken: string) => void;
  isConnected: boolean;
  isReconnecting?: boolean;
  reconnectMessage?: string;
}

export function PlaidConnectionSection({ 
  onSuccess, 
  isConnected,
  isReconnecting = false,
  reconnectMessage = "Reconnecting to your bank..."
}: PlaidConnectionSectionProps) {
  const [showReconnectMsg, setShowReconnectMsg] = useState(false);
  
  // Show reconnect message when reconnecting flag is true
  useEffect(() => {
    if (isReconnecting) {
      setShowReconnectMsg(true);
      
      // Hide message after 3 seconds if still shown
      const timer = setTimeout(() => {
        setShowReconnectMsg(false);
      }, 3000);
      
      return () => clearTimeout(timer);
    } else {
      setShowReconnectMsg(false);
    }
  }, [isReconnecting]);

  return (
    <div className="flex flex-col items-center space-y-3">
      {!isConnected ? (
        <>
          {showReconnectMsg && (
            <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-2 rounded flex items-center mb-2">
              <div className="w-4 h-4 mr-2 border-t-2 border-r-2 border-blue-700 rounded-full animate-spin"></div>
              {reconnectMessage}
            </div>
          )}
          <PlaidLink onSuccess={onSuccess} />
        </>
      ) : (
        <div className="flex flex-col items-center">
          <span className="bg-green-100 text-green-800 text-sm px-3 py-1 rounded-full flex items-center">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
            </svg>
            Bank account connected
          </span>
          <span className="text-xs text-gray-500 mt-1">
            Your connection will be automatically restored when you return
          </span>
        </div>
      )}
    </div>
  );
}