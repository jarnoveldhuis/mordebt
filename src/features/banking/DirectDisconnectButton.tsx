import React from 'react';
import { useBankConnection } from './useBankConnection';
import { useAuth } from '@/shared/hooks/useAuth';

export function DirectDisconnectButton() {
  const { user } = useAuth();
  const { disconnectBank, emergencyDisconnect } = useBankConnection(user);
  const [isDisconnecting, setIsDisconnecting] = React.useState(false);

  const handleDirectDisconnect = async () => {
    if (isDisconnecting) return;
    
    try {
      setIsDisconnecting(true);
      
      // First clear any session/local storage flags
      sessionStorage.removeItem('wasManuallyDisconnected');
      localStorage.removeItem('plaid_access_token_info');
      localStorage.removeItem('bank_connection_status');
      localStorage.removeItem('bank_disconnect_timestamp');
      localStorage.removeItem('bank_connection_state');
      
      // Use emergency disconnect for the most aggressive cleanup
      await emergencyDisconnect();
      
      // Force page reload after a short delay
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 500);
      
    } catch (error) {
      console.error('Error during emergency disconnect:', error);
      setIsDisconnecting(false);
      
      // Force reload anyway in case of error
      window.location.reload();
    }
  };

  return (
    <button
      onClick={handleDirectDisconnect}
      disabled={isDisconnecting}
      className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 disabled:bg-gray-400"
    >
      {isDisconnecting ? 'Disconnecting...' : 'Emergency Disconnect'}
    </button>
  );
} 