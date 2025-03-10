"use client";

import { useEffect, useState } from "react";


declare global {
  interface Window {
    Plaid: {
      create: (config: {
        token: string;
        onSuccess: (public_token: string) => void;
        onExit: (error?: PlaidError) => void;
      }) => { open: () => void };
    };
  }
}

interface PlaidError {
  error_code: string;
  error_message: string;
  display_message: string | null;
}

interface PlaidLinkProps {
  onSuccess: (public_token: string) => void;
}

export default function PlaidLink({ onSuccess }: PlaidLinkProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchLinkToken() {
      try {
        if (process.env.PLAID_ENV === "sandbox") {
          console.warn("⚠️ Bypassing Plaid UI in Sandbox mode.");
          return; // ✅ No need to fetch link token in Sandbox
        }

        const response = await fetch("/api/plaid/create_link_token", { method: "GET" });
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
    if (process.env.PLAID_ENV === "sandbox") {
      setLoading(true);
      try {
        console.warn("⚡ Fetching sandbox token from API...");
  
        const response = await fetch("/api/plaid/sandbox_token", { method: "POST" });
        const data = await response.json();
  
        if (!data.public_token) {
          throw new Error("Sandbox API did not return a public_token");
        }
  
        console.log("✅ Sandbox Public Token:", data.public_token);
        onSuccess(data.public_token);
      } catch (error) {
        console.error("❌ Error generating sandbox token:", error);
      } finally {
        setLoading(false);
      }
      return;
    }
  
    // ✅ Open Plaid UI in Production
    if (!linkToken) return;
  
    const handler = window.Plaid.create({
      token: linkToken,
      onSuccess: (public_token: string) => {
        console.log("✅ Plaid Success! public_token:", public_token);
        onSuccess(public_token);
      },
      onExit: (error?: PlaidError) => {
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
