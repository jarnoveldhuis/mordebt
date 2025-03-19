// src/features/banking/EmergencyResetButton.tsx
import { forceDisconnectAndReload } from './forceDisconnect';

interface EmergencyResetButtonProps {
  className?: string;
}

export function EmergencyResetButton({ className = "" }: EmergencyResetButtonProps) {
  const handleReset = () => {
    if (confirm('⚠️ WARNING: This will completely disconnect your bank account and reset all connection data.\n\nAre you sure you want to proceed?')) {
      // Show immediate feedback
      alert('Disconnecting... Page will reload when complete.');
      
      // Execute force disconnect with page reload
      forceDisconnectAndReload();
    }
  };
  
  return (
    <button
      onClick={handleReset}
      className={`bg-red-700 hover:bg-red-800 text-white px-4 py-2 rounded-lg flex items-center ${className}`}
    >
      <span className="mr-2">⚠️</span>
      <span>Emergency Bank Reset</span>
    </button>
  );
}