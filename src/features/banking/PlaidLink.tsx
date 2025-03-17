// src/features/banking/PlaidLink.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { config } from "@/config";

interface PlaidErrorType {
  error_code?: string;
  error_message?: string;
  display_message?: string;
}

declare global {
  interface Window {
    Plaid: {
      create: (config: {
        token: string;
        onSuccess: (public_token: string) => void;
        onExit: (error?: PlaidErrorType) => void;
      }) => { open: () => void };
    };
  }
}

interface PlaidLinkProps {
  onSuccess: (public_token: string) => void;
}

export default function PlaidLink({ onSuccess }: PlaidLinkProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch Link token on component mount
  useEffect(() => {
    async function fetchLinkToken() {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch("/api/banking/create_link_token", { method: "GET" });
        
        if (!response.ok) {
          throw new Error(`Failed to create link token: ${response.status}`);
        }
        
        const data = await response.json();
        console.log("Generated Plaid Link Token");
        setLinkToken(data.link_token);
      } catch (err) {
        console.error("❌ Error fetching Plaid link token:", err);
        setError(err instanceof Error ? err.message : "Failed to initialize Plaid");
      } finally {
        setLoading(false);
      }
    }

    // Always fetch link token regardless of environment
    fetchLinkToken();
  }, []);

  // Handle sandbox mode with bank selection
  const handleSandboxMode = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Instead of auto-generating a sandbox token, 
      // let's get a link token for sandbox mode
      const response = await fetch("/api/banking/create_link_token", { 
        method: "GET",
        headers: { 
          "Content-Type": "application/json",
          "X-Sandbox-Selection": "true" // Signal we want bank selection in sandbox
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to create sandbox link token: ${response.status}`);
      }
      
      const data = await response.json();
      console.log("✅ Generated sandbox link token for bank selection");
      
      // Now open Plaid Link with this token to allow bank selection
      const handler = window.Plaid.create({
        token: data.link_token,
        onSuccess: (public_token: string) => {
          console.log("✅ Plaid Success with bank selection!");
          onSuccess(public_token);
        },
        onExit: (err?: PlaidErrorType) => {
          if (err) {
            console.error("❌ Plaid Link Exit Error:", err);
            setError(err.display_message || err.error_message || "Plaid connection canceled");
          }
        },
      });
    
      handler.open();
    } catch (err) {
      console.error("❌ Error in sandbox mode:", err);
      setError(err instanceof Error ? err.message : "Failed to create sandbox connection");
    } finally {
      setLoading(false);
    }
  }, [onSuccess]);

  // Open Plaid Link
  const openPlaidLink = useCallback(() => {
    // For sandbox mode, use the simplified approach
    if (config.plaid.isSandbox) {
      handleSandboxMode();
      return;
    }
    
    // For production mode, use the regular Plaid Link
    if (!linkToken) {
      setError("Plaid initialization failed. Please try again.");
      return;
    }
    
    try {
      const handler = window.Plaid.create({
        token: linkToken,
        onSuccess: (public_token: string) => {
          console.log("✅ Plaid Success!");
          onSuccess(public_token);
        },
        onExit: (err?: PlaidErrorType) => {
          if (err) {
            console.error("❌ Plaid Link Exit Error:", err);
            setError(err.display_message || err.error_message || "Plaid connection canceled");
          }
        },
      });
    
      handler.open();
    } catch (err) {
      console.error("❌ Error opening Plaid Link:", err);
      setError(err instanceof Error ? err.message : "Failed to open Plaid Link");
    }
  }, [linkToken, handleSandboxMode, onSuccess]);

  return (
    <div className="flex flex-col items-center">
      {error && (
        <div className="text-red-500 mb-4 text-sm">
          {error}
        </div>
      )}
      
      <button
        onClick={openPlaidLink}
        className={`bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-200 ${
          loading ? "opacity-70 cursor-not-allowed" : ""
        }`}
        disabled={loading}
      >
        {loading ? "Connecting..." : "Connect Bank Account"}
      </button>
      
      {config.plaid.isSandbox && (
        <div className="mt-2 text-xs text-gray-500">
          Running in sandbox mode
        </div>
      )}
    </div>
  );
}