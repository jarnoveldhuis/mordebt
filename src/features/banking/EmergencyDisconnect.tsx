import React from 'react';
import { useBankConnection } from './useBankConnection';
import { useAuth } from '@/shared/hooks/useAuth';

interface EmergencyDisconnectProps {
  isConnected?: boolean;
  onDisconnect?: () => void;
}

export function EmergencyDisconnect({ isConnected, onDisconnect }: EmergencyDisconnectProps = {}) {
  const { user } = useAuth();
  const { emergencyDisconnect } = useBankConnection(user);

  const handleResetConnection = async () => {
    try {
      // Use the emergencyDisconnect function for a complete cleanup
      await emergencyDisconnect();
      
      // Call the parent's onDisconnect if provided
      if (onDisconnect) {
        onDisconnect();
      }
      
      // Force page reload after a short delay
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 500);
    } catch (error) {
      console.error('Error during connection reset:', error);
      
      // Force reload anyway in case of error
      window.location.reload();
    }
  };

  return (
    <div className="flex flex-col items-center">
      <button
        onClick={handleResetConnection}
        className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
      >
        Reset Bank Connection
      </button>
      <p className="text-xs text-red-500 mt-2">
        This will completely reset your bank connection, allowing you to connect again.
      </p>
    </div>
  );
} 