// src/shared/components/Header.tsx
import { User } from "firebase/auth";

interface HeaderProps {
  user: User | null;
  onLogout: () => void;
  onDisconnectBank?: () => void;
  isBankConnected?: boolean;
}

export function Header({ 
  user, 
  onLogout, 
  onDisconnectBank, 
  isBankConnected = false 
}: HeaderProps) {
  return (
    <div className="flex justify-between items-center mb-4">
      <div className='text-3xl font-bold text-gray-900 text-center mb-3'>Ethinomics</div>
      <span className="text-sm text-gray-500">
        {user?.email}
      </span>
      <div className="flex items-center space-x-2">
        {isBankConnected && onDisconnectBank && (
          <button
            onClick={onDisconnectBank}
            className="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-2 rounded shadow text-sm"
          >
            Disconnect Bank
          </button>
        )}
        <button
          onClick={onLogout}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded shadow"
        >
          Logout
        </button>
      </div>
    </div>
  );
}