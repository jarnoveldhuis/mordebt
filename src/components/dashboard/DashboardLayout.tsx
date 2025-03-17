// src/components/dashboard/DashboardLayout.tsx
import { User } from "firebase/auth";
import { ReactNode } from "react";
import { DisconnectBankButton } from "@/features/banking/DisconnectBankButton";

interface DashboardLayoutProps {
  children: ReactNode;
  user: User | null;
  onLogout: () => void;
  onDisconnectBank?: () => void;
  isBankConnected?: boolean;
}

export function DashboardLayout({ 
  children, 
  user, 
  onLogout, 
  onDisconnectBank,
  isBankConnected = false
}: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo and title */}
            <div className="flex items-center">
              <span className="text-2xl">🌍</span>
              <h1 className="ml-2 text-xl font-bold bg-gradient-to-r from-blue-500 to-indigo-600 bg-clip-text text-transparent">
                Ethinomics
              </h1>
            </div>

            {/* User menu */}
            <div className="flex items-center space-x-4">
              {/* Bank connection status */}
              {isBankConnected && (
                <div className="hidden sm:flex items-center">
                  <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full flex items-center">
                    <span className="h-2 w-2 bg-green-500 rounded-full mr-1"></span>
                    Connected
                  </span>
                  {onDisconnectBank && (
                    <DisconnectBankButton 
                      onDisconnect={onDisconnectBank}
                      isConnected={isBankConnected}
                    />
                  )}
                </div>
              )}
              
              {/* User profile */}
              <div className="relative flex items-center">
                <div className="flex items-center space-x-2 cursor-pointer">
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white">
                    <span className="text-sm font-medium">{user?.email?.charAt(0).toUpperCase() || "U"}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="hidden sm:block font-medium text-sm">
                      {user?.email || "User"}
                    </span>
                    <button 
                      onClick={onLogout}
                      className="text-xs text-red-600 text-left hover:text-red-800"
                    >
                      Logout
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center text-xs text-gray-500">
            &copy; {new Date().getFullYear()} Ethinomics. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}