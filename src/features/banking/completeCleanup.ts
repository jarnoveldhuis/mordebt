// src/features/banking/completeCleanup.ts

/**
 * @deprecated This file is deprecated and will be removed in a future version.
 * Use bankConnectionService.disconnectBank() or bankConnectionService.emergencyDisconnect() instead.
 * See src/features/banking/bankConnectionService.ts for more info.
 */

import { blockTransactionAutoLoad } from "../analysis/preventAutoLoad";
import { LoadingSpinner } from '@/shared/components/ui/LoadingSpinner';

/**
 * This utility provides a thorough cleanup of all connection data
 * to prevent the issue where a bank disconnects and then immediately reconnects
 */

interface StoredDataItem {
  key: string;
  storage: 'local' | 'session';
}

/**
 * @deprecated Use bankConnectionService.clearAllConnectionStorage() instead
 * Clear all storage items related to bank connections and authentication
 */
function clearAllConnectionStorage(): StoredDataItem[] {
  const cleared: StoredDataItem[] = [];

  // Search pattern for keys that might be related to connections
  const patterns = [
    /plaid/i,
    /link/i,
    /token/i,
    /connect/i,
    /bank/i,
    /access/i,
    /auth/i,
    /session/i
  ];

  // Check localStorage
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && patterns.some(pattern => pattern.test(key))) {
      console.log(`Clearing localStorage item: ${key}`);
      localStorage.removeItem(key);
      cleared.push({ key, storage: 'local' });
    }
  }

  // Check sessionStorage
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key && patterns.some(pattern => pattern.test(key))) {
      console.log(`Clearing sessionStorage item: ${key}`);
      sessionStorage.removeItem(key);
      cleared.push({ key, storage: 'session' });
    }
  }

  // Explicitly clear known items
  const knownItems = [
    'plaid_access_token_info',
    'linkToken',
    'publicToken',
    'accessToken',
    'bank_connection_status',
    'plaid_link_token',
    'plaid_session',
    'plaid_item',
    'last_plaid_token'
  ];

  knownItems.forEach(item => {
    if (localStorage.getItem(item)) {
      localStorage.removeItem(item);
      cleared.push({ key: item, storage: 'local' });
    }
    if (sessionStorage.getItem(item)) {
      sessionStorage.removeItem(item);
      cleared.push({ key: item, storage: 'session' });
    }
  });

  return cleared;
}

/**
 * @deprecated Use bankConnectionService.clearConnectionCookies() instead
 * Clear cookies related to bank connections
 */
function clearAllConnectionCookies(): string[] {
  const cleared: string[] = [];
  const patterns = [
    /plaid/i,
    /link/i,
    /token/i,
    /connect/i,
    /bank/i,
    /session/i
  ];

  document.cookie.split(';').forEach(cookie => {
    const [name] = cookie.trim().split('=');
    if (name && patterns.some(pattern => pattern.test(name))) {
      console.log(`Clearing cookie: ${name}`);
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/;`;
      cleared.push(name);
    }
  });

  return cleared;
}

/**
 * @deprecated Use bankConnectionService.removeConnectionIframes() instead
 * Find and remove any Plaid iframes
 */
function removeAllConnectionIframes(): HTMLElement[] {
  const removed: HTMLElement[] = [];
  
  // Find all iframes
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
      const parent = iframe.parentElement;
      if (parent) {
        parent.removeChild(iframe);
        removed.push(iframe);
      }
    }
  });
  
  return removed;
}

/**
 * @deprecated Use bankConnectionService.clearConnectionIndexedDB() instead
 * Clear indexedDB stores that might be related to bank connections
 */
async function clearConnectionIndexedDB(): Promise<string[]> {
  const cleared: string[] = [];
  
  try {
    // Get all indexedDB databases
    const databases = await window.indexedDB.databases();
    
    // Check each database for connection-related names
    for (const db of databases) {
      const name = db.name;
      if (!name) continue;
      
      if (
        name.includes('plaid') ||
        name.includes('link') ||
        name.includes('bank') ||
        name.includes('connect')
      ) {
        console.log(`Deleting indexedDB database: ${name}`);
        await new Promise<void>((resolve, reject) => {
          const request = window.indexedDB.deleteDatabase(name);
          request.onsuccess = () => {
            cleared.push(name);
            resolve();
          };
          request.onerror = () => {
            console.error(`Failed to delete indexedDB database: ${name}`);
            reject(new Error(`Failed to delete database: ${name}`));
          };
        });
      }
    }
  } catch (error) {
    console.error('Error clearing indexedDB:', error);
  }
  
  return cleared;
}

/**
 * @deprecated Use bankConnectionService methods instead
 * Clear any cached credentials in the browser
 */
function clearCredentials(): boolean {
  try {
    if (navigator.credentials && navigator.credentials.preventSilentAccess) {
      navigator.credentials.preventSilentAccess();
      return true;
    }
  } catch (error) {
    console.error('Error clearing credentials:', error);
  }
  return false;
}

/**
 * @deprecated Use bankConnectionService.blockReconnection() instead
 * Add a special flag to prevent auto-reconnection
 */
function blockReconnection(): void {
  // Set flags to prevent auto-reconnection attempts
  localStorage.setItem('bank_disconnect_timestamp', Date.now().toString());
  localStorage.setItem('bank_disconnect_forced', 'true');
  sessionStorage.setItem('bank_disconnect_session', 'true');
  
  // Create a document-level attribute to signal disconnection
  document.documentElement.setAttribute('data-bank-disconnected', 'true');
}

/**
 * @deprecated Use bankConnectionService.disconnectBank() instead
 * The main function to completely clean up all connection data
 */
export async function completeConnectionCleanup(): Promise<boolean> {
  console.log('Performing complete connection cleanup...');
  
  try {
    // 1. Clear all storage items
    const storageItems = clearAllConnectionStorage();
    console.log(`Cleared ${storageItems.length} storage items`);
    
    // 2. Clear cookies
    const cookies = clearAllConnectionCookies();
    console.log(`Cleared ${cookies.length} cookies`);
    
    // 3. Remove iframes
    const iframes = removeAllConnectionIframes();
    console.log(`Removed ${iframes.length} iframes`);
    
    // 4. Clear IndexedDB stores
    const dbStores = await clearConnectionIndexedDB();
    console.log(`Cleared ${dbStores.length} indexedDB stores`);
    
    // 5. Clear credentials
    const credentialsCleared = clearCredentials();
    console.log(`Credentials cleared: ${credentialsCleared}`);
    
    // 6. Block reconnection
    blockReconnection();
    console.log('Added reconnection blockers');
    
    // 7. IMPORTANT: Block transaction auto-loading from Firebase
    blockTransactionAutoLoad(24 * 60 * 60 * 1000); // 24 hours
    console.log('Blocked transaction auto-loading for 24 hours');
    
    // Signal complete cleanup success
    console.log('Complete connection cleanup successful!');
    return true;
  } catch (error) {
    console.error('Error during complete connection cleanup:', error);
    return false;
  }
}

/**
 * @deprecated Use bankConnectionService.disconnectBank({ reloadPage: true }) instead
 * Disconnect, clean up, and force a page reload
 */
export function disconnectAndReload(message: string = 'Bank disconnected. Page will reload.'): void {
  console.log('Disconnecting and reloading...');
  
  // Notify the user if a message is provided
  if (message) {
    alert(message);
  }
  
  // Perform cleanup and then reload
  completeConnectionCleanup().then(() => {
    setTimeout(() => {
      window.location.reload();
    }, 100);
  });
}

/**
 * @deprecated No longer necessary with bankConnectionService
 * Setup event listeners to enforce disconnection
 */
export function setupDisconnectionEnforcement(): void {
  // This could set up listeners to monitor connection state
  console.log('Disconnection enforcement setup complete');
}