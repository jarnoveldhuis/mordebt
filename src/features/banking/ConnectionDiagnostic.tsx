import { useState, useEffect } from 'react';
import { bankConnectionService } from './bankConnectionService';

interface ConnectionDiagnosticProps {
  userId?: string | null;
  onReset?: () => void;
}

export function ConnectionDiagnostic({ userId, onReset }: ConnectionDiagnosticProps) {
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [expanded, setExpanded] = useState(false);
  
  useEffect(() => {
    // Only run in development 
    if (process.env.NODE_ENV !== 'development') return;
    
    // Update debug info every 2 seconds
    const interval = setInterval(() => {
      setDebugInfo(bankConnectionService.getDebugInfo());
    }, 2000);
    
    // Initial fetch
    setDebugInfo(bankConnectionService.getDebugInfo());
    
    return () => clearInterval(interval);
  }, []);
  
  if (process.env.NODE_ENV !== 'development' || !debugInfo) {
    return null;
  }
  
  const hasConnectionIssue = !debugInfo.persistedState?.isConnected && 
                             debugInfo.reconnectAttemptsCount > 0;
  
  return (
    <div className="text-xs bg-gray-100 p-2 rounded border border-gray-300 mt-4">
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-gray-700 flex items-center">
          <span className={debugInfo.persistedState?.isConnected ? "text-green-600 mr-1" : "text-red-600 mr-1"}>⬤</span>
          Bank Connection Status
        </h3>
        
        <div className="space-x-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-blue-600 hover:text-blue-800 underline"
          >
            {expanded ? 'Hide Details' : 'Show Details'}
          </button>
          
          {onReset && (
            <button
              onClick={onReset}
              className="text-red-600 hover:text-red-800 underline"
            >
              Reset Connection
            </button>
          )}
        </div>
      </div>
      
      {hasConnectionIssue && (
        <div className="mt-2 p-2 bg-yellow-100 border border-yellow-300 rounded">
          <p className="font-semibold text-yellow-800">
            Connection issue detected. The persisted state indicates you 
            should be connected, but auto-reconnection attempts failed.
          </p>
          {debugInfo.reconnectBlocked && (
            <p className="mt-1 text-yellow-700">
              Auto-reconnection is currently blocked. You may need to reset the connection.
            </p>
          )}
        </div>
      )}
      
      {expanded && (
        <div className="mt-2 space-y-2">
          <div>
            <p className="font-semibold">User ID: {userId || debugInfo.currentUserId || 'None'}</p>
            <p>Connection Status: {debugInfo.persistedState?.isConnected ? 'Connected' : 'Disconnected'}</p>
            <p>Attempts: {debugInfo.reconnectAttemptsCount}</p>
            <p>Reconnect Blocked: {debugInfo.reconnectBlocked ? 'Yes' : 'No'}</p>
          </div>
          
          <div className="overflow-x-auto">
            <details>
              <summary className="cursor-pointer hover:text-blue-600">Persisted State</summary>
              <pre className="bg-gray-50 p-1 text-xs mt-1 max-h-36 overflow-auto">
                {JSON.stringify(debugInfo.persistedState, null, 2)}
              </pre>
            </details>
            
            <details>
              <summary className="cursor-pointer hover:text-blue-600">Stored Token</summary>
              <pre className="bg-gray-50 p-1 text-xs mt-1 max-h-36 overflow-auto">
                {debugInfo.storedToken ? (
                  JSON.stringify({
                    userId: debugInfo.storedToken.userId,
                    timestamp: debugInfo.storedToken.timestamp,
                    hasToken: !!debugInfo.storedToken.token
                  }, null, 2)
                ) : 'No stored token'}
              </pre>
            </details>
            
            <details>
              <summary className="cursor-pointer hover:text-blue-600">Last Error</summary>
              <pre className="bg-gray-50 p-1 text-xs mt-1 max-h-36 overflow-auto">
                {debugInfo.lastError ? 
                  (typeof debugInfo.lastError === 'string' 
                    ? debugInfo.lastError 
                    : JSON.stringify(debugInfo.lastError, null, 2)) 
                  : 'No errors recorded'
                }
              </pre>
            </details>
          </div>
          
          <div className="text-gray-500 italic">
            Last updated: {new Date().toLocaleTimeString()}
          </div>
        </div>
      )}
    </div>
  );
} 