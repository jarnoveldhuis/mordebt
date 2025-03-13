"use client";

import { useEffect, useState } from "react";
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
  onSuccess: (public_token: string | null) => void; // Updated to accept null
}

export default function PlaidLink({ onSuccess }: PlaidLinkProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchLinkToken() {
      try {
        if (config.plaid.isSandbox) {
          console.warn("⚠️ Bypassing Plaid UI in Sandbox mode.");
          return; // No need to fetch link token in Sandbox
        }

        const response = await fetch("/api/banking/create_link_token", { method: "GET" });
        const data = await response.json();
        console.log("Generated Plaid Link Token:", data.link_token);
        setLinkToken(data.link_token);
      } catch (error) {
        console.error("❌ Error fetching Plaid link token:", error);
      }
    }

    fetchLinkToken();
  }, []);

  async function openPlaidLink() {
    if (config.plaid.isSandbox) {
      setLoading(true);
      try {
        // In sandbox mode, just call onSuccess directly with null
        console.warn("⚡ Using sample data in sandbox mode...");
        onSuccess(null); // Pass null to indicate sandbox mock mode
      } catch (error) {
        console.error("❌ Error in sandbox mode:", error);
      } finally {
        setLoading(false);
      }
      return;
    }
  
    // Regular Plaid Link flow for non-sandbox
    if (!linkToken) return;
    
    const handler = window.Plaid.create({
      token: linkToken,
      onSuccess: (public_token: string) => {
        console.log("✅ Plaid Success! public_token:", public_token);
        onSuccess(public_token);
      },
      onExit: (error?: PlaidErrorType) => {
        if (error) console.error("❌ Plaid Link Exit Error:", error);
      },
    });
  
    handler.open();
  }

  return (
    <button
      onClick={openPlaidLink}
      className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-200"
      disabled={loading}
    >
      {loading ? "Connecting..." : "Connect Bank Account"}
    </button>
  );
}