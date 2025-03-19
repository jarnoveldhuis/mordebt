// src/features/banking/EmergencyResetButton.tsx
import { useState } from 'react';
import { bankConnectionService } from './bankConnectionService';

interface EmergencyResetButtonProps {
  variant?: 'default' | 'small' | 'icon';
}

export function EmergencyResetButton({ variant = 'default' }: EmergencyResetButtonProps) {
  const [isResetting, setIsResetting] = useState(false);
  
  // Execute emergency disconnect
  const handleEmergencyReset = async () => {
    if (isResetting) return;
    
    if (!confirm('This will completely reset your bank connection and reload the page. Continue?')) {
      return;
    }
    
    setIsResetting(true);
    
    try {
      await bankConnectionService.emergencyDisconnect();
      // The page will reload automatically from the emergencyDisconnect function
    } catch (error) {
      console.error('Error during emergency reset:', error);
      setIsResetting(false);
      alert('Reset failed. Try reloading the page manually.');
    }
  };
  
  // Render button based on variant
  if (variant === 'small') {
    return (
      <button 
        onClick={handleEmergencyReset}
        disabled={isResetting}
        className="text-xs text-red-600 underline hover:text-red-800"
      >
        {isResetting ? 'Resetting...' : 'Emergency Reset'}
      </button>
    );
  }
  
  if (variant === 'icon') {
    return (
      <button 
        onClick={handleEmergencyReset}
        disabled={isResetting}
        className="text-red-600 hover:text-red-800"
        title="Emergency Connection Reset"
      >
        ⚠️
      </button>
    );
  }
  
  // Default variant
  return (
    <button 
      onClick={handleEmergencyReset}
      disabled={isResetting}
      className="bg-red-100 text-red-700 hover:bg-red-200 border border-red-300 rounded px-3 py-1 text-sm"
    >
      {isResetting ? 'Resetting Connection...' : 'Emergency Reset'}
    </button>
  );
}