// src/features/banking/connectionReset.ts

/**
 * @deprecated This file is deprecated and will be removed in a future version.
 * Use bankConnectionService.disconnectBank() or bankConnectionService.emergencyDisconnect() instead.
 * See src/features/banking/bankConnectionService.ts for more info.
 */

/**
 * Helper functions to fully reset bank connections
 */

/**
 * @deprecated Use bankConnectionService.disconnectBank() instead
 * Completely resets all connection and storage data
 * Use this when normal disconnection functions don't work
 */
export function forceResetBankConnection(): boolean {
  try {
    console.log("🧹 Force resetting all bank connection data...");

    // Clear all Plaid-related storage
    localStorage.removeItem("plaid_access_token_info");

    // Look for any other Plaid-related items in localStorage
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes("plaid") || key.includes("link"))) {
        console.log(`Clearing additional storage item: ${key}`);
        localStorage.removeItem(key);
      }
    }

    // Clear session storage as well (Plaid may store some data here)
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && (key.includes("plaid") || key.includes("link"))) {
        console.log(`Clearing session storage item: ${key}`);
        sessionStorage.removeItem(key);
      }
    }

    // Clear any persistent Plaid cookies
    document.cookie.split(";").forEach((cookie) => {
      const [name] = cookie.trim().split("=");
      if (name && (name.includes("plaid") || name.includes("link"))) {
        console.log(`Clearing cookie: ${name}`);
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/;`;
      }
    });

    console.log("✅ Connection data reset complete");
    return true;
  } catch (error) {
    console.error("❌ Error during force reset:", error);
    return false;
  }
}

/**
 * @deprecated Use bankConnectionService developer utilities instead
 * Add this to the window object for debugging
 * Can be called from developer console with: window.resetBankConnection()
 */
export function exposeResetFunctionGlobally(): void {
  if (typeof window !== "undefined") {
    // Only do this in development
    if (process.env.NODE_ENV === "development") {
      window.resetBankConnection = forceResetBankConnection;
      console.log(
        "🛠️ Bank connection reset function exposed as window.resetBankConnection()"
      );
    }
  }
}

/**
 * @deprecated No longer needed with bankConnectionService
 * Initialize the utility
 * Call this once from a high-level component
 */
export function initConnectionReset(): void {
  exposeResetFunctionGlobally();
}
