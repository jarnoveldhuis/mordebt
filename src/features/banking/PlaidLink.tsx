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
  onSuccess: (public_token: string | null) => void;
}

export default function PlaidLink({ onSuccess }: PlaidLinkProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch Link token on component mount
  useEffect(() => {
    // Skip in sandbox mode
    if (config.plaid.isSandbox || config.plaid.useSampleData) {
      console.log("⚠️ Skipping Link token in Sandbox/Sample mode");
      return;
    }
    
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

    fetchLinkToken();
  }, []);

  // Handle sandbox mode separately
  const handleSandboxMode = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // In sandbox mode, generate a sandbox token
      const response = await fetch("/api/banking/sandbox_token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to create sandbox token: ${response.status}`);
      }
      
      const data = await response.json();
      console.log("✅ Generated sandbox token");
      
      // Call onSuccess with the sandbox token
      onSuccess(data.public_token);
    } catch (err) {
      console.error("❌ Error in sandbox mode:", err);
      setError(err instanceof Error ? err.message : "Failed to create sandbox connection");
    } finally {
      setLoading(false);
    }
  }, [onSuccess]);

  // Open Plaid Link
  const openPlaidLink = useCallback(() => {
    // Handle sandbox mode
    if (config.plaid.isSandbox || config.plaid.useSampleData) {
      handleSandboxMode();
      return;
    }
    
    // Handle regular Plaid Link
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