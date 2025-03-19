// src/shared/components/Header.tsx
"use client";

import { User } from "firebase/auth";
import { useState, useRef, useEffect, useCallback } from "react";

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
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Handle disconnect bank with confirmation
  const handleDisconnectBank = useCallback(() => {
    if (!onDisconnectBank) return;
    
    // If we're already in confirming state, perform the actual disconnect
    if (isDisconnecting) {
      onDisconnectBank();
      setIsDisconnecting(false);
      setDropdownOpen(false);
    } else {
      // Otherwise, enter confirmation state
      setIsDisconnecting(true);
    }
  }, [isDisconnecting, onDisconnectBank]);

  // Cancel disconnect
  const cancelDisconnect = useCallback(() => {
    setIsDisconnecting(false);
  }, []);

  return (
    <div className="flex justify-between items-center mb-4">
      <div className="text-3xl font-bold text-gray-900">Ethinomics</div>
      
      {/* User dropdown menu */}
      <div className="relative" ref={dropdownRef}>
        <button 
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center space-x-2 bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-lg transition-colors"
        >
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white">
            {user?.email?.charAt(0).toUpperCase() || "U"}
          </div>
          <span className="text-sm text-gray-700 max-w-[150px] truncate">
            {user?.email || "User"}
          </span>
          <svg 
            className={`w-4 h-4 text-gray-500 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Dropdown menu */}
        {dropdownOpen && (
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg overflow-hidden z-10 border border-gray-200">
            {/* Connection status */}
            <div className="px-4 py-3 border-b border-gray-100">
              <div className="text-sm font-medium text-gray-700">Connection Status</div>
              <div className="flex items-center mt-1">
                <div className={`w-2 h-2 rounded-full mr-2 ${isBankConnected ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                <span className="text-xs text-gray-600">
                  {isBankConnected ? 'Bank Connected' : 'No Bank Connected'}
                </span>
              </div>
            </div>
            
            {/* Disconnect bank option - only show if connected */}
            {isBankConnected && onDisconnectBank && (
              <div className="px-4 py-2 border-b border-gray-100">
                {isDisconnecting ? (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-700">Are you sure? This will clear all transaction data.</p>
                    <div className="flex space-x-2">
                      <button
                        onClick={handleDisconnectBank}
                        className="text-sm text-white bg-red-600 hover:bg-red-700 px-2 py-1 rounded flex-1"
                      >
                        Disconnect
                      </button>
                      <button
                        onClick={cancelDisconnect}
                        className="text-sm text-gray-700 bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded flex-1"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={handleDisconnectBank}
                    className="w-full text-left text-sm text-red-600 hover:text-red-800"
                  >
                    Disconnect Bank
                  </button>
                )}
              </div>
            )}
            
            {/* Logout button */}
            <button
              onClick={() => {
                onLogout();
                setDropdownOpen(false);
              }}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 focus:outline-none"
            >
              Logout
            </button>
          </div>
        )}
      </div>
    </div>
  );
}