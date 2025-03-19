// src/features/banking/PlaidLink.tsx
"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { config } from "@/config";
import Script from 'next/script';

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
  onLoadingChange?: (isLoading: boolean) => void;
}

export default function PlaidLink({ onSuccess, onLoadingChange }: PlaidLinkProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plaidScriptLoaded, setPlaidScriptLoaded] = useState(false);
  const [scriptReloaded, setScriptReloaded] = useState(false);
  
  // Reference to the interval for cleanup
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Update parent component when loading state changes
  useEffect(() => {
    if (onLoadingChange) {
      onLoadingChange(loading);
    }
  }, [loading, onLoadingChange]);

  // Function to manually reload the Plaid script if needed
  const reloadPlaidScript = useCallback(() => {
    if (scriptReloaded) return; // Only reload once
    
    console.log("Attempting to reload Plaid script...");
    setScriptReloaded(true);
    
    // Remove existing script if present
    const existingScript = document.querySelector('script[src*="plaid"]');
    if (existingScript && existingScript.parentNode) {
      existingScript.parentNode.removeChild(existingScript);
    }
    
    // Create and append a new script
    const script = document.createElement('script');
    script.src = "https://cdn.plaid.com/link/v2/stable/link-initialize.js";
    script.async = true;
    script.onload = () => {
      console.log("Plaid script successfully reloaded");
      setPlaidScriptLoaded(true);
    };
    
    document.head.appendChild(script);
  }, [scriptReloaded]);
  
  // Check if Plaid script is loaded
  useEffect(() => {
    function checkPlaidLoaded() {
      if (typeof window !== "undefined" && window.Plaid) {
        console.log("Plaid script detected as loaded");
        setPlaidScriptLoaded(true);
        return true;
      }
      return false;
    }

    // Check immediately
    if (checkPlaidLoaded()) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // If not loaded, set up a retry interval
    intervalRef.current = setInterval(() => {
      // If we've checked several times and still not loaded, try reloading the script
      if (!checkPlaidLoaded()) {
        const retryCount = intervalRef.current ? 6 : 0; // After approximately 3 seconds
        if (!scriptReloaded && retryCount >= 6) {
          reloadPlaidScript();
        }
      } else if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }, 500); // Check every 500ms

    // Clean up
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [scriptReloaded, reloadPlaidScript]);

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
    if (!plaidScriptLoaded) {
      console.error("❌ Plaid script not loaded yet");
      setError("Plaid is still initializing. Please try again in a moment.");
      return;
    }

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
      
      // Make sure Plaid is available before trying to use it
      if (!window.Plaid || !window.Plaid.create) {
        throw new Error("Plaid is not initialized properly. Please refresh the page and try again.");
      }

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
  }, [onSuccess, plaidScriptLoaded]);

  // Open Plaid Link
  const openPlaidLink = useCallback(() => {
    if (!plaidScriptLoaded) {
      console.error("❌ Plaid script not loaded yet");
      setError("Plaid is still initializing. Please try again in a moment.");
      return;
    }

    // Set loading state true when opening Plaid
    setLoading(true);

    // For sandbox mode, use the simplified approach
    if (config.plaid.isSandbox) {
      handleSandboxMode();
      return;
    }
    
    // For production mode, use the regular Plaid Link
    if (!linkToken) {
      setError("Plaid initialization failed. Please try again.");
      setLoading(false);
      return;
    }
    
    try {
      // Make sure Plaid is available before trying to use it
      if (!window.Plaid || !window.Plaid.create) {
        throw new Error("Plaid is not initialized properly. Please refresh the page and try again.");
      }

      const handler = window.Plaid.create({
        token: linkToken,
        onSuccess: (public_token: string) => {
          console.log("✅ Plaid Success!");
          // Keep loading state true since we're about to process the token
          onSuccess(public_token);
        },
        onExit: (err?: PlaidErrorType) => {
          // Reset loading when user exits Plaid
          setLoading(false);
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
      setLoading(false);
    }
  }, [linkToken, handleSandboxMode, onSuccess, plaidScriptLoaded]);

  return (
    <div className="flex flex-col items-center">
      {/* Add the script here as a backup */}
      {!plaidScriptLoaded && !scriptReloaded && (
        <Script
          src="https://cdn.plaid.com/link/v2/stable/link-initialize.js"
          strategy="afterInteractive"
          onLoad={() => {
            console.log("Backup Plaid script loaded");
            setPlaidScriptLoaded(true);
          }}
        />
      )}
      
      {error && (
        <div className="text-red-500 mb-4 text-sm">
          {error}
        </div>
      )}
      
      <button
        onClick={openPlaidLink}
        className={`bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-200 ${
          loading || !plaidScriptLoaded ? "opacity-70 cursor-not-allowed" : ""
        }`}
        disabled={loading || !plaidScriptLoaded}
      >
        {loading ? "Connecting..." : plaidScriptLoaded ? "Connect Bank Account" : "Loading Plaid..."}
      </button>
      
      {!plaidScriptLoaded && (
        <button
          onClick={reloadPlaidScript}
          className="mt-2 text-xs text-blue-500 underline"
          disabled={scriptReloaded}
        >
          {scriptReloaded ? "Reloading script..." : "Reload Plaid"}
        </button>
      )}
      
      {config.plaid.isSandbox && (
        <div className="mt-2 text-xs text-gray-500">
          Running in sandbox mode
        </div>
      )}
    </div>
  );
}