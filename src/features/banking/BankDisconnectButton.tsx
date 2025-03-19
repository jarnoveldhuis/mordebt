// src/features/banking/BankDisconnectButton.tsx
import { useState, useCallback } from 'react';
import { forceDisconnectAndReload } from './forceDisconnect';

interface BankDisconnectButtonProps {
  onDisconnect: () => void;
  isConnected: boolean;
  className?: string;
}

export function BankDisconnectButton({ 
  onDisconnect, 
  isConnected,
  className = ""
}: BankDisconnectButtonProps) {
  const [confirming, setConfirming] = useState(false);
  const [showForceOption, setShowForceOption] = useState(false);
  
  const handleDisconnect = useCallback(() => {
    if (confirming) {
      // Actually disconnect
      onDisconnect();
      setConfirming(false);
    } else {
      // Show confirmation first
      setConfirming(true);
    }
  }, [confirming, onDisconnect]);
  
  const forceDisconnect = useCallback(() => {
    // Perform a complete cleanup
    forceDisconnectAndReload();
    
    // Reset UI state
    setConfirming(false);
    setShowForceOption(false);
  }, []);
  
  const cancelDisconnect = useCallback(() => {
    setConfirming(false);
    setShowForceOption(false);
  }, []);
  
  if (!isConnected) {
    return null;
  }
  
  if (confirming) {
    return (
      <div className={`flex flex-col space-y-2 ${className}`}>
        <div className="flex space-x-2">
          <button
            onClick={handleDisconnect}
            className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm"
          >
            Confirm Disconnect
          </button>
          <button
            onClick={cancelDisconnect}
            className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-3 py-1 rounded text-sm"
          >
            Cancel
          </button>
        </div>
        
        {!showForceOption && (
          <button
            onClick={() => setShowForceOption(true)}
            className="text-xs text-gray-500 underline"
          >
            Connection issues?
          </button>
        )}
        
        {showForceOption && (
          <button
            onClick={forceDisconnect}
            className="bg-red-800 hover:bg-red-900 text-white px-3 py-1 rounded text-xs"
          >
            Force Full Disconnect
          </button>
        )}
      </div>
    );
  }
  
  return (
    <button
      onClick={handleDisconnect}
      className={`text-red-600 hover:text-red-800 text-sm underline ${className}`}
    >
      Disconnect Bank
    </button>
  );
}