// src/features/banking/DisconnectBankButton.tsx
import { useState, useCallback } from 'react';

interface DisconnectBankButtonProps {
  onDisconnect: () => void;
  isConnected: boolean;
}

export function DisconnectBankButton({ onDisconnect, isConnected }: DisconnectBankButtonProps) {
  const [confirming, setConfirming] = useState(false);
  
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
  
  const cancelDisconnect = useCallback(() => {
    setConfirming(false);
  }, []);
  
  if (!isConnected) {
    return null;
  }
  
  if (confirming) {
    return (
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
    );
  }
  
  return (
    <button
      onClick={handleDisconnect}
      className="text-red-600 hover:text-red-800 text-sm underline"
    >
      Disconnect Bank
    </button>
  );
}