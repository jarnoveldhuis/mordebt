// src/features/banking/forceDisconnect.ts

/**
 * A standalone utility that forcefully disconnects from Plaid
 * and clears all related storage, regardless of React state
 * 
 * This is a "nuclear option" for when normal disconnection doesn't work
 */

/**
 * Forcefully clean all Plaid-related data from browser
 */
function cleanPlaidStorage(): void {
    console.log("🧹 Cleaning all Plaid-related storage...");
    
    try {
      // 1. Clear our own token storage
      localStorage.removeItem('plaid_access_token_info');
      
      // 2. Find and clear any Plaid-related items in localStorage
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (
          key.toLowerCase().includes('plaid') || 
          key.toLowerCase().includes('link') ||
          key.toLowerCase().includes('bank') ||
          key.toLowerCase().includes('connect')
        )) {
          console.log(`Removing localStorage item: ${key}`);
          localStorage.removeItem(key);
        }
      }
      
      // 3. Find and clear any Plaid-related items in sessionStorage
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && (
          key.toLowerCase().includes('plaid') || 
          key.toLowerCase().includes('link') ||
          key.toLowerCase().includes('bank') ||
          key.toLowerCase().includes('connect')
        )) {
          console.log(`Removing sessionStorage item: ${key}`);
          sessionStorage.removeItem(key);
        }
      }
      
      // 4. Clear any Plaid-related cookies
      document.cookie.split(';').forEach(cookie => {
        const [name] = cookie.trim().split('=');
        if (name && (
          name.toLowerCase().includes('plaid') || 
          name.toLowerCase().includes('link') ||
          name.toLowerCase().includes('bank')
        )) {
          console.log(`Clearing cookie: ${name}`);
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/;`;
        }
      });
      
      console.log("✅ Plaid storage cleanup completed");
    } catch (error) {
      console.error("Error cleaning Plaid storage:", error);
    }
  }
  
  /**
   * Try to find and clean up any Plaid iframes
   */
  function cleanPlaidIframes(): void {
    console.log("🧹 Cleaning any Plaid iframes...");
    
    try {
      // Look for any Plaid-related iframes
      const iframes = document.querySelectorAll('iframe');
      
      iframes.forEach(iframe => {
        const src = iframe.src || '';
        if (
          src.includes('plaid') || 
          src.includes('link') ||
          iframe.id.includes('plaid') ||
          iframe.className.includes('plaid')
        ) {
          console.log(`Removing iframe: ${iframe.id || iframe.src}`);
          iframe.remove();
        }
      });
      
      console.log("✅ Iframe cleanup completed");
    } catch (error) {
      console.error("Error cleaning Plaid iframes:", error);
    }
  }
  
  /**
   * Primary function to forcefully disconnect from Plaid
   * @returns Promise that resolves to true if successful
   */
  export async function forceDisconnect(): Promise<boolean> {
    console.log("☢️ Executing force disconnect...");
    
    try {
      // 1. Clean up storage
      cleanPlaidStorage();
      
      // 2. Clean up any iframes
      cleanPlaidIframes();
      
      // 3. Add a small delay to ensure everything is cleaned up
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // 4. Try to inform the user
      console.log("✅ Force disconnect completed successfully");
      
      return true;
    } catch (error) {
      console.error("❌ Force disconnect failed:", error);
      return false;
    }
  }
  
  /**
   * Nuclear option - disconnect and reload the page
   * @returns never - this function doesn't return
   */
  export function forceDisconnectAndReload(): void {
    forceDisconnect().then(() => {
      console.log("🔄 Reloading page after force disconnect...");
      
      // Set a flag in sessionStorage so we know the page was reloaded
      // due to a force disconnect
      sessionStorage.setItem('just_force_disconnected', 'true');
      
      // Reload the page
      window.location.reload();
    });
  }
  
  /**
   * Check if we just performed a force disconnect
   * @returns boolean
   */
  export function wasJustForceDisconnected(): boolean {
    const wasDisconnected = sessionStorage.getItem('just_force_disconnected') === 'true';
    
    // Clear the flag
    if (wasDisconnected) {
      sessionStorage.removeItem('just_force_disconnected');
    }
    
    return wasDisconnected;
  }
  
  // Expose to window for emergency debugging
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    window.FORCE_DISCONNECT_PLAID = forceDisconnectAndReload;
    console.log("🛠️ Emergency disconnect exposed as window.FORCE_DISCONNECT_PLAID()");
  }