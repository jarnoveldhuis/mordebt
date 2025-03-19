import { useEffect, useState } from 'react';
import { useAuth } from '@/shared/hooks/useAuth';
import { useBankConnection } from './useBankConnection';
import { LoadingSpinner } from '@/shared/components/ui/LoadingSpinner';
import { useDashboardState } from '@/features/dashboard/useDashboardState';
import { DirectDisconnectButton } from './DirectDisconnectButton';

export function BankingDashboard() {
  const { user } = useAuth();
  const { 
    connectionStatus, 
    transactions, 
    connectBank, 
    disconnectBank,
    resetConnection,
    ConnectionDebugPanel,
    emergencyDisconnect
  } = useBankConnection(user);

  // Get dashboard state for effective connection status
  const { 
    effectiveConnectionStatus, 
    handleDisconnectBank, 
    wasManuallyDisconnected,
    bankConnecting,
    loadingMessage
  } = useDashboardState();

  // Transaction monitoring (debug logs removed)
  useEffect(() => {
    // Debug logs removed for production
  }, [transactions]);

  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [isLinkReady, setIsLinkReady] = useState(false);
  const [forceShowConnect, setForceShowConnect] = useState(false);
  
  // Force exit from loading after timeout
  useEffect(() => {
    if ((connectionStatus.isLoading || bankConnecting) && !forceShowConnect) {
      const timer = setTimeout(() => {
        // Force connect screen without debug logging
        setForceShowConnect(true);
      }, 5000); // Extend timeout to 5 seconds
      
      return () => clearTimeout(timer);
    }
  }, [connectionStatus.isLoading, bankConnecting, forceShowConnect]);
  
  // Reset forceShowConnect when connection status changes
  useEffect(() => {
    if (!connectionStatus.isLoading && !bankConnecting) {
      setForceShowConnect(false);
    }
  }, [connectionStatus.isLoading, bankConnecting]);
  
  // Get link token on component mount
  useEffect(() => {
    async function fetchLinkToken() {
      try {
        const response = await fetch('/api/banking/create_link_token');
        const data = await response.json();
        
        if (data.link_token) {
          setLinkToken(data.link_token);
          setIsLinkReady(true);
        }
      } catch (error) {
        console.error('Error getting link token:', error);
      }
    }
    
    if (user && !connectionStatus.isConnected && !linkToken) {
      fetchLinkToken();
    }
  }, [user, connectionStatus.isConnected, linkToken]);
  
  // Open Plaid Link on button click
  const handleOpenPlaidLink = () => {
    if (!linkToken) return;
    
    // In a real implementation, you would open the Plaid Link here
    // This is a simulated implementation for demonstration
    console.log("Opening Plaid Link with token:", linkToken);
    
    // For testing in development we're mocking the connection
    if (process.env.NODE_ENV === 'development') {
      // Mock successful connection for demo purposes
      setTimeout(() => {
        const mockPublicToken = `public-sandbox-${Date.now()}`;
        handlePlaidSuccess(mockPublicToken);
      }, 1000);
    }
  };
  
  // Handle successful Plaid Link flow by delegating to the proper handler
  const handlePlaidSuccess = async (publicToken: string) => {
    try {
      console.log("Received public token in BankingDashboard:", publicToken);
      
      // Use a safer approach than recreating the hook
      const dashboardHandleSuccess = useDashboardState().handlePlaidSuccess;
      if (dashboardHandleSuccess) {
        console.log("Delegating to dashboard's handlePlaidSuccess");
        await dashboardHandleSuccess(publicToken);
      } else {
        // Fallback to direct connection if needed
        console.log("Fallback to direct connectBank");
        await connectBank(publicToken);
      }
    } catch (error) {
      console.error('Error connecting bank:', error);
    }
  };
  
  // Handle disconnection
  const handleDisconnect = async () => {
    try {
      await disconnectBank();
    } catch (error) {
      console.error('Error disconnecting bank:', error);
    }
  };
  
  // Handle direct disconnection from Plaid
  const handleDirectDisconnect = async () => {
    try {
      // Pass explicit options to ensure Plaid connection is removed
      await disconnectBank({
        clearStoredData: true,
        clearCookies: true,
        removeIframes: true,
        clearIndexedDB: true,
        preventAutoReconnect: true,
        reloadPage: true // Force a page reload to ensure clean state
      });
    } catch (error) {
      console.error('Error disconnecting bank:', error);
    }
  };
  
  // Handle emergency disconnection
  const handleEmergencyDisconnect = async () => {
    try {
      // Use the emergencyDisconnect function for a complete cleanup
      await emergencyDisconnect();
    } catch (error) {
      console.error('Error during emergency disconnect:', error);
    }
  };
  
  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Banking Dashboard</h1>
      
      {/* Emergency Disconnect Button - Always visible */}
      <div className="bg-red-50 border border-red-200 rounded p-3 mb-4 flex items-center justify-between">
        <div>
          <h3 className="font-medium text-red-800">Bank Connection Issues?</h3>
          <p className="text-sm text-red-700">If you're having problems, use this emergency disconnect.</p>
        </div>
        <DirectDisconnectButton />
      </div>
      
      {(connectionStatus.isLoading || bankConnecting) && !forceShowConnect ? (
        <div className="flex items-center justify-center py-8">
          <LoadingSpinner message={loadingMessage || "Connecting to your bank..."} />
        </div>
      ) : transactions.length > 0 && !wasManuallyDisconnected ? (
        <>
          <div className="bg-green-50 border border-green-200 rounded p-4 mb-4">
            <p className="text-green-800 font-semibold">
              {effectiveConnectionStatus 
                ? (connectionStatus.isConnected 
                    ? "Successfully connected to your bank account" 
                    : "Using your previously saved transactions")
                : "Disconnected from bank account"}
            </p>
            {effectiveConnectionStatus ? (
              <div className="mt-2 flex space-x-2">
                <button
                  onClick={handleDisconnectBank}
                  className="bg-white border border-red-300 text-red-600 px-4 py-2 rounded hover:bg-red-50"
                >
                  Disconnect Bank
                </button>
                <button
                  onClick={handleDirectDisconnect}
                  className="bg-white border border-red-500 text-red-700 px-4 py-2 rounded hover:bg-red-50"
                  title="Force disconnect from Plaid"
                >
                  Force Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={handleOpenPlaidLink}
                className="mt-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                disabled={!isLinkReady}
              >
                Connect Bank
              </button>
            )}
          </div>
          
          <div className="mt-6">
            <h2 className="text-xl font-semibold mb-3">Your Transactions</h2>
            <div className="border rounded overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {transactions.slice(0, 10).map((tx, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{tx.date}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{tx.name}</td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${tx.amount >= 100 ? 'text-red-600' : 'text-gray-900'}`}>
                        ${tx.amount.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-gray-50 border border-gray-200 rounded p-6 text-center">
          <h2 className="text-xl font-semibold mb-3">
            {wasManuallyDisconnected 
              ? "Bank Disconnected" 
              : "Connect Your Bank Account"}
          </h2>
          <p className="text-gray-600 mb-4">
            {wasManuallyDisconnected
              ? "You have disconnected your bank account. Connect again to see your transactions."
              : "Connect your bank account to see your transactions and get personalized insights."}
          </p>
          <button
            onClick={handleOpenPlaidLink}
            disabled={!isLinkReady || bankConnecting}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
          >
            {bankConnecting 
              ? 'Connecting...'
              : isLinkReady 
                ? (wasManuallyDisconnected ? 'Reconnect Bank Account' : 'Connect Bank Account') 
                : 'Loading...'}
          </button>
          
          {connectionStatus.error && (
            <p className="mt-4 text-red-600">
              Error: {connectionStatus.error}
            </p>
          )}
        </div>
      )}
      
      {/* Debug Panel - only shown in development */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-8">
          <ConnectionDebugPanel />
          
          <div className="mt-4 text-right space-x-2">
            <button
              onClick={resetConnection}
              className="bg-gray-200 text-gray-800 px-4 py-1 rounded text-xs hover:bg-gray-300"
            >
              Reset Connection
            </button>
            
            <button
              onClick={handleEmergencyDisconnect}
              className="bg-red-200 text-red-800 px-4 py-1 rounded text-xs hover:bg-red-300"
            >
              Emergency Disconnect
            </button>
          </div>
        </div>
      )}
    </div>
  );
} 