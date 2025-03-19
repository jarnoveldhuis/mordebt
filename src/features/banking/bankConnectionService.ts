import { User } from 'firebase/auth';
import { Transaction } from '@/shared/types/transactions';
import { blockTransactionAutoLoad } from '../analysis/preventAutoLoad';

// Define standardized status and types
export interface ConnectionStatus {
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface AccessTokenInfo {
  token: string;
  userId: string;
  timestamp: number;
}

export interface StoredDataItem {
  key: string;
  storage: 'local' | 'session';
}

export interface DisconnectionOptions {
  clearStoredData?: boolean;
  clearTransactions?: boolean;
  preventAutoReconnect?: boolean;
  clearIndexedDB?: boolean;
  clearCookies?: boolean;
  removeIframes?: boolean;
  reloadPage?: boolean;
  preventAutoLoadHours?: number;
}

export class BankConnectionService {
  private static instance: BankConnectionService;
  private currentUser: User | null = null;
  private previousUserId: string | null = null;
  private clearStateTimeout: NodeJS.Timeout | null = null;
  private readonly TOKEN_STORAGE_KEY = 'plaid_access_token_info';
  private readonly CONNECTION_STATUS_KEY = 'bank_connection_status';
  private readonly DISCONNECT_TIMESTAMP_KEY = 'bank_disconnect_timestamp';
  private readonly DISCONNECT_FORCED_KEY = 'bank_disconnect_forced';
  private readonly DISCONNECT_SESSION_KEY = 'bank_disconnect_session';
  private readonly CONNECTION_STATE_KEY = 'bank_connection_state';
  private readonly TOKEN_STATE_KEY = 'plaid_token_state';
  
  // New debug variables
  private _debugMode: boolean = process.env.NODE_ENV === 'development';
  private _lastReconnectAttempt: number = 0;
  private _reconnectAttemptsCount: number = 0;
  private _lastError: any = null;

  // Private constructor for singleton pattern
  private constructor() {
    // Initialize any needed state
    if (this._debugMode && typeof window !== 'undefined') {
      // Expose the service instance for debugging
      (window as any).__bankConnectionService = this;
      console.log('🔍 Bank connection service available for debugging as window.__bankConnectionService');
    }
  }

  // Get the singleton instance
  public static getInstance(): BankConnectionService {
    if (!BankConnectionService.instance) {
      BankConnectionService.instance = new BankConnectionService();
    }
    return BankConnectionService.instance;
  }
  
  // Debug helper
  private debug(message: string, ...args: any[]): void {
    if (this._debugMode) {
      console.log(`🏦 [BankConnectionService] ${message}`, ...args);
    }
  }
  
  // Get debug info
  public getDebugInfo(): any {
    return {
      currentUserId: this.currentUser?.uid || null,
      lastReconnectAttempt: new Date(this._lastReconnectAttempt).toISOString(),
      reconnectAttemptsCount: this._reconnectAttemptsCount,
      lastError: this._lastError,
      persistedState: this.getPersistedState(),
      storedToken: this.getStoredTokenInfo(),
      reconnectBlocked: this.isReconnectBlocked(),
      sessionDisconnect: sessionStorage.getItem(this.DISCONNECT_SESSION_KEY),
      localDisconnect: localStorage.getItem(this.DISCONNECT_FORCED_KEY),
      disconnectTimestamp: localStorage.getItem(this.DISCONNECT_TIMESTAMP_KEY)
    };
  }
  
  // Get stored token info without verification (for debugging)
  private getStoredTokenInfo(): any {
    try {
      const storedData = localStorage.getItem(this.TOKEN_STORAGE_KEY);
      if (!storedData) return null;
      return JSON.parse(storedData);
    } catch (error) {
      return { error: 'Failed to parse stored token' };
    }
  }
  
  // Get the persisted connection state
  private getPersistedState(): any {
    try {
      const storedState = localStorage.getItem(this.CONNECTION_STATE_KEY);
      if (!storedState) return null;
      return JSON.parse(storedState);
    } catch (error) {
      return { error: 'Failed to parse persisted state' };
    }
  }

  // Set the current user
  public setUser(user: User | null): void {
    // If transitioning from a user to null, don't immediately clear state
    // since this might be a temporary state during page transitions
    if (!user && this.currentUser) {
      this.debug('User temporarily set to null, delaying connection state clearing');
      
      // Clear any existing timeout to avoid race conditions
      if (this.clearStateTimeout) {
        clearTimeout(this.clearStateTimeout);
      }
      
      // Set a small timeout to clear state only if the user remains null
      this.clearStateTimeout = setTimeout(() => {
        // Only clear state if still null after the timeout
        if (!this.currentUser) {
          this.debug('User still null after delay, clearing connection state');
          this.previousUserId = null;
          this.clearInternalConnectionState();
        }
      }, 2000); // 2 second delay
    } 
    // If transitioning from null to user
    else if (user && !this.currentUser) {
      this.debug(`User set to ${user.uid}`);
      
      // Clear any pending timeout to avoid race conditions
      if (this.clearStateTimeout) {
        clearTimeout(this.clearStateTimeout);
        this.clearStateTimeout = null;
      }
      
      // Only clear state if user is different from previous user
      if (this.previousUserId && this.previousUserId !== user.uid) {
        this.debug('New user different from previous, clearing connection state');
        this.clearInternalConnectionState();
      } else {
        this.debug('Same user or first login, keeping connection state');
      }
      
      // Remember this user's ID
      this.previousUserId = user.uid;
    }
    
    // Always update current user reference
    this.currentUser = user;
  }
  
  // Private method to actually clear internal state
  private clearInternalConnectionState(): void {
    // Clear all connection state from local storage
    this.removeFromLocalStorage(this.CONNECTION_STATE_KEY);
    this.removeFromLocalStorage(this.TOKEN_STATE_KEY);
    this.removeFromLocalStorage(this.TOKEN_STORAGE_KEY);
    this.removeFromLocalStorage(this.CONNECTION_STATUS_KEY);
    
    // Also clear session storage items
    this.removeFromSessionStorage(this.CONNECTION_STATE_KEY);
    this.removeFromSessionStorage(this.TOKEN_STATE_KEY);
    
    // Set disconnect flags to ensure we don't auto-reconnect
    this.setInLocalStorage(this.DISCONNECT_FORCED_KEY, 'true');
    this.setInLocalStorage(this.DISCONNECT_TIMESTAMP_KEY, Date.now().toString());
    this.setInSessionStorage(this.DISCONNECT_SESSION_KEY, 'true');
    
    this.debug('Cleared internal connection state and set disconnect flags');
  }
  
  // Check if sessionStorage/localStorage is available
  private isStorageAvailable(): boolean {
    return typeof window !== 'undefined' && typeof sessionStorage !== 'undefined' && typeof localStorage !== 'undefined';
  }

  // Safely get from sessionStorage
  private getFromSessionStorage(key: string): string | null {
    if (!this.isStorageAvailable()) return null;
    try {
      return sessionStorage.getItem(key);
    } catch (e) {
      this.debug('Error accessing sessionStorage:', e);
      return null;
    }
  }

  // Safely get from localStorage
  private getFromLocalStorage(key: string): string | null {
    if (!this.isStorageAvailable()) return null;
    try {
      return localStorage.getItem(key);
    } catch (e) {
      this.debug('Error accessing localStorage:', e);
      return null;
    }
  }

  // Safely set in sessionStorage
  private setInSessionStorage(key: string, value: string): void {
    if (!this.isStorageAvailable()) return;
    try {
      sessionStorage.setItem(key, value);
    } catch (e) {
      this.debug('Error setting sessionStorage:', e);
    }
  }

  // Safely set in localStorage
  private setInLocalStorage(key: string, value: string): void {
    if (!this.isStorageAvailable()) return;
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      this.debug('Error setting localStorage:', e);
    }
  }

  // Safely remove from sessionStorage
  private removeFromSessionStorage(key: string): void {
    if (!this.isStorageAvailable()) return;
    try {
      sessionStorage.removeItem(key);
    } catch (e) {
      this.debug('Error removing from sessionStorage:', e);
    }
  }

  // Safely remove from localStorage
  private removeFromLocalStorage(key: string): void {
    if (!this.isStorageAvailable()) return;
    try {
      localStorage.removeItem(key);
    } catch (e) {
      this.debug('Error removing from localStorage:', e);
    }
  }

  // Check if reconnection is blocked
  private _isReconnectBlocked(): boolean {
    // Skip during server-side rendering
    if (!this.isStorageAvailable()) {
      return false;
    }
    
    // Add additional debug logging
    this.debug('Checking if reconnection is blocked', {
      sessionFlag: this.getFromSessionStorage(this.DISCONNECT_SESSION_KEY),
      forcedFlag: this.getFromLocalStorage(this.DISCONNECT_FORCED_KEY),
      timestamp: this.getFromLocalStorage(this.DISCONNECT_TIMESTAMP_KEY)
    });
    
    // Check session storage first (should override anything else)
    if (this.getFromSessionStorage(this.DISCONNECT_SESSION_KEY) === 'true') {
      this.debug('Reconnect blocked by session flag');
      return true;
    }
    
    // Check forced disconnect flag
    if (this.getFromLocalStorage(this.DISCONNECT_FORCED_KEY) === 'true') {
      const disconnectTimestamp = this.getFromLocalStorage(this.DISCONNECT_TIMESTAMP_KEY);
      
      // If we have a timestamp, check if it's recent (last 30 minutes)
      if (disconnectTimestamp) {
        const timestamp = parseInt(disconnectTimestamp, 10);
        const now = Date.now();
        const timeSinceDisconnect = now - timestamp;
        
        // Only block reconnect for 30 minutes after forced disconnect
        if (timeSinceDisconnect < 30 * 60 * 1000) {
          this.debug('Reconnect blocked by recent forced disconnect', {
            timeSinceDisconnect: `${Math.round(timeSinceDisconnect / (60 * 1000))} minutes`
          });
          return true;
        } else {
          // Clear outdated disconnect flags
          this.debug('Clearing outdated disconnect flags');
          this.removeFromLocalStorage(this.DISCONNECT_FORCED_KEY);
          this.removeFromLocalStorage(this.DISCONNECT_TIMESTAMP_KEY);
        }
      }
    }
    
    return false;
  }

  // Public method to check if reconnection is blocked
  public isReconnectBlocked(): boolean {
    return this._isReconnectBlocked();
  }

  // Persist connection state
  private persistConnectionState(connected: boolean, accessToken?: string | null): void {
    if (!this.currentUser) {
      this.debug('Cannot persist connection state: no user');
      return;
    }
    
    try {
      const state = {
        isConnected: connected,
        userId: this.currentUser.uid,
        timestamp: Date.now()
      };
      
      // Store connection state
      localStorage.setItem(this.CONNECTION_STATE_KEY, JSON.stringify(state));
      
      // Optionally update token state
      if (accessToken) {
        const tokenState = {
          hasToken: true,
          userId: this.currentUser.uid,
          timestamp: Date.now()
        };
        localStorage.setItem(this.TOKEN_STATE_KEY, JSON.stringify(tokenState));
      }
      
      this.debug('Persisted connection state', { connected, hasToken: !!accessToken });
    } catch (error) {
      console.error('Failed to persist connection state:', error);
    }
  }

  // Store access token securely
  public storeAccessToken(accessToken: string): boolean {
    if (!this.currentUser) return false;
    
    try {
      // Create token info with user ID and timestamp
      const tokenInfo: AccessTokenInfo = {
        token: accessToken,
        userId: this.currentUser.uid,
        timestamp: Date.now()
      };
      
      // Store in localStorage
      localStorage.setItem(this.TOKEN_STORAGE_KEY, JSON.stringify(tokenInfo));
      
      // Also update persisted state
      this.persistConnectionState(true, accessToken);
      
      this.debug("Access token stored successfully");
      return true;
    } catch (error) {
      console.warn("Could not store access token:", error);
      return false;
    }
  }
  
  // Get the stored access token
  public getAccessToken(): string | null {
    if (!this.currentUser) return null;
    
    try {
      const storedData = localStorage.getItem(this.TOKEN_STORAGE_KEY);
      if (!storedData) return null;
      
      const tokenInfo: AccessTokenInfo = JSON.parse(storedData);
      
      // Verify the token belongs to current user
      if (tokenInfo.userId !== this.currentUser.uid) {
        this.debug("Stored token belongs to a different user", {
          tokenUserId: tokenInfo.userId,
          currentUserId: this.currentUser.uid
        });
        localStorage.removeItem(this.TOKEN_STORAGE_KEY);
        return null;
      }
      
      // Verify token isn't too old (30 days expiry)
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
      if (Date.now() - tokenInfo.timestamp > thirtyDaysMs) {
        this.debug("Stored token has expired");
        localStorage.removeItem(this.TOKEN_STORAGE_KEY);
        return null;
      }
      
      this.debug("Retrieved valid access token");
      return tokenInfo.token;
    } catch (error) {
      console.warn("Error retrieving stored access token:", error);
      this._lastError = error;
      return null;
    }
  }

  // Exchange a public token for an access token
  public async exchangePublicToken(publicToken: string): Promise<string> {
    this.debug("Exchanging public token for access token");
    
    const response = await fetch("/api/banking/exchange_token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ public_token: publicToken }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      const error = new Error(`Token exchange failed: ${response.status} - ${errorText}`);
      this._lastError = error;
      throw error;
    }

    const tokenData = await response.json();
    
    if (!tokenData.access_token) {
      const error = new Error("No access token received from server");
      this._lastError = error;
      throw error;
    }

    this.debug("Successfully exchanged public token for access token");
    return tokenData.access_token;
  }

  // Fetch transactions using an access token
  public async fetchTransactions(accessToken: string): Promise<Transaction[]> {
    this.debug("Fetching transactions with access token");
    
    const response = await fetch("/api/banking/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ access_token: accessToken }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      const error = new Error(`Failed to fetch transactions: ${response.status} - ${errorText}`);
      this._lastError = error;
      throw error;
    }

    const data = await response.json();
    
    if (!Array.isArray(data)) {
      const error = new Error(`Invalid transactions data: expected array but received ${typeof data}`);
      this._lastError = error;
      throw error;
    }
    
    this.debug(`Successfully fetched ${data.length} transactions`);
    
    // Initialize transactions with analysis placeholders
    return data.map((tx: any, index: number) => ({
      date: typeof tx.date === 'string' ? tx.date : new Date().toISOString().split('T')[0],
      name: typeof tx.name === 'string' ? tx.name : `Unknown (${index})`,
      amount: typeof tx.amount === 'number' ? Math.abs(tx.amount) : 0,
      societalDebt: 0,
      unethicalPractices: [],
      ethicalPractices: [],
      information: {},
      analyzed: false
    }));
  }

  // Clear all connection storage
  private clearAllConnectionStorage(): StoredDataItem[] {
    // Skip if storage is not available
    if (!this.isStorageAvailable()) {
      return [];
    }
    
    const cleared: StoredDataItem[] = [];
    const patterns = [
      /plaid/i, /link/i, /token/i, /connect/i, /bank/i, /access/i, /auth/i, /session/i, /transaction/i, /item/i
    ];

    // Explicitly clear known items first
    const knownItems = [
      this.TOKEN_STORAGE_KEY,
      this.CONNECTION_STATUS_KEY,
      this.CONNECTION_STATE_KEY, 
      this.TOKEN_STATE_KEY,
      'linkToken',
      'publicToken',
      'accessToken',
      'plaid_link_token',
      'plaid_session',
      'plaid_item',
      'last_plaid_token',
      'plaid_item_id',
      'plaid_access_token',
      'bank_connection_data',
      'bank_status',
      'plaid_public_token',
      'plaid_account_id',
      'plaid_institution_id',
      'plaid_link_session',
      'transactions_last_updated',
      'transactions_data'
    ];

    // Clear from localStorage
    knownItems.forEach(item => {
      try {
        const value = this.getFromLocalStorage(item);
        if (value) {
          this.removeFromLocalStorage(item);
          cleared.push({ key: item, storage: 'local' });
        }
      } catch (e) {
        this.debug(`Error clearing localStorage item ${item}:`, e);
      }
    });

    // Clear from sessionStorage
    knownItems.forEach(item => {
      try {
        const value = this.getFromSessionStorage(item);
        if (value) {
          this.removeFromSessionStorage(item);
          cleared.push({ key: item, storage: 'session' });
        }
      } catch (e) {
        this.debug(`Error clearing sessionStorage item ${item}:`, e);
      }
    });

    // Then search for pattern matches in localStorage
    try {
      if (typeof localStorage !== 'undefined') {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && patterns.some(pattern => pattern.test(key))) {
            this.removeFromLocalStorage(key);
            cleared.push({ key, storage: 'local' });
          }
        }
      }
    } catch (e) {
      this.debug("Error clearing pattern-based localStorage items:", e);
    }

    // And in sessionStorage
    try {
      if (typeof sessionStorage !== 'undefined') {
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i);
          if (key && patterns.some(pattern => pattern.test(key))) {
            this.removeFromSessionStorage(key);
            cleared.push({ key, storage: 'session' });
          }
        }
      }
    } catch (e) {
      this.debug("Error clearing pattern-based sessionStorage items:", e);
    }
    
    // Final check: ensure the main items are definitely removed
    [this.TOKEN_STORAGE_KEY, this.CONNECTION_STATE_KEY].forEach(item => {
      try {
        this.removeFromLocalStorage(item);
        this.removeFromSessionStorage(item);
      } catch (e) {
        this.debug(`Final cleanup error for ${item}:`, e);
      }
    });

    return cleared;
  }

  // Clear cookies related to bank connections
  private clearConnectionCookies(): string[] {
    const cleared: string[] = [];
    const patterns = [
      /plaid/i, /link/i, /token/i, /connect/i, /bank/i, /session/i
    ];

    document.cookie.split(';').forEach(cookie => {
      const [name] = cookie.trim().split('=');
      if (name && patterns.some(pattern => pattern.test(name))) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/;`;
        cleared.push(name);
      }
    });

    return cleared;
  }

  // Remove Plaid iframes
  private removeConnectionIframes(): HTMLElement[] {
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
        const parent = iframe.parentElement;
        if (parent) {
          parent.removeChild(iframe);
          removed.push(iframe);
        }
      }
    });
    
    return removed;
  }

  // Clear indexedDB stores that might be related to bank connections
  private async clearConnectionIndexedDB(): Promise<string[]> {
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

  // Block auto-reconnection
  private blockReconnection(): void {
    const now = Date.now();
    this.debug('Blocking reconnection', { timestamp: now });
    
    // Set both localStorage and sessionStorage flags
    this.setInLocalStorage(this.DISCONNECT_TIMESTAMP_KEY, now.toString());
    this.setInLocalStorage(this.DISCONNECT_FORCED_KEY, 'true');
    this.setInSessionStorage(this.DISCONNECT_SESSION_KEY, 'true');
    
    // Add a data attribute to the document for additional tracking
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-bank-disconnected', 'true');
    }
    
    // Also clear any stored connection state to prevent reconnection
    this.clearInternalConnectionState();
  }

  // Main disconnection method with configurable options
  public async disconnectBank(options: DisconnectionOptions = {}): Promise<boolean> {
    this.debug('Disconnecting bank connection with options:', options);
    
    try {
      // Default options
      const {
        clearStoredData = true,
        clearCookies = true,
        removeIframes = true,
        clearIndexedDB = true,
        preventAutoReconnect = true,
        reloadPage = false,
        preventAutoLoadHours = 0
      } = options;
      
      // 1. Block auto reconnection first, before any other cleanup
      if (preventAutoReconnect) {
        this.blockReconnection();
        this.debug('Added reconnection blockers');
      }
      
      // 2. Clear token and related storage
      if (clearStoredData) {
        const cleared = this.clearAllConnectionStorage();
        this.debug(`Cleared ${cleared.length} storage items`);
      }
      
      // 3. Clear cookies if requested
      if (clearCookies) {
        const cookies = this.clearConnectionCookies();
        this.debug(`Cleared ${cookies.length} cookies`);
      }
      
      // 4. Remove iframes if requested
      if (removeIframes) {
        const iframes = this.removeConnectionIframes();
        this.debug(`Removed ${iframes.length} iframes`);
      }
      
      // 5. Clear IndexedDB if requested
      if (clearIndexedDB) {
        const dbStores = await this.clearConnectionIndexedDB();
        this.debug(`Cleared ${dbStores.length} indexedDB stores`);
      }
      
      // 6. Block transaction auto-loading if hours > 0
      if (preventAutoLoadHours > 0) {
        const milliseconds = preventAutoLoadHours * 60 * 60 * 1000;
        blockTransactionAutoLoad(milliseconds);
        this.debug(`Blocked transaction auto-loading for ${preventAutoLoadHours} hours`);
      }
      
      // Always update the persisted state
      this.persistConnectionState(false);
      
      // 7. Reload page if requested (after a brief delay)
      if (reloadPage) {
        setTimeout(() => {
          window.location.reload();
        }, 100);
      }
      
      this.debug('Bank disconnection successful');
      return true;
    } catch (error) {
      console.error('Error during bank disconnection:', error);
      this._lastError = error;
      return false;
    }
  }
  
  // Emergency disconnect method - uses all options for maximum cleanup
  public async emergencyDisconnect(): Promise<boolean> {
    this.debug('EMERGENCY DISCONNECT initiated');
    return this.disconnectBank({
      clearStoredData: true,
      clearCookies: true,
      removeIframes: true,
      clearIndexedDB: true,
      preventAutoReconnect: true,
      reloadPage: true,
      preventAutoLoadHours: 24 // 24 hours
    });
  }
  
  // Connect to bank with a public token
  public async connectBank(publicToken: string): Promise<{ 
    success: boolean; 
    accessToken?: string; 
    transactions?: Transaction[];
    error?: string;
  }> {
    if (!publicToken) {
      return { 
        success: false, 
        error: "No public token provided" 
      };
    }

    try {
      this.debug("Connecting bank with public token");
      
      // 1. Exchange public token for access token
      const accessToken = await this.exchangePublicToken(publicToken);
      
      // 2. Store the access token
      const stored = this.storeAccessToken(accessToken);
      if (!stored) {
        this.debug("Failed to store access token, but connection will continue");
      }
      
      // 3. Fetch transactions
      const transactions = await this.fetchTransactions(accessToken);
      
      // 4. Clear any reconnection blocks
      localStorage.removeItem(this.DISCONNECT_FORCED_KEY);
      localStorage.removeItem(this.DISCONNECT_TIMESTAMP_KEY);
      sessionStorage.removeItem(this.DISCONNECT_SESSION_KEY);
      
      // 5. Update persisted state
      this.persistConnectionState(true, accessToken);
      
      this.debug("Bank connection successful");
      return {
        success: true,
        accessToken,
        transactions
      };
    } catch (error) {
      console.error("Bank connection error:", error);
      this._lastError = error;
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to connect bank account"
      };
    }
  }
  
  // Check if we should attempt auto-reconnect based on persisted state
  public shouldAttemptReconnect(): boolean {
    if (!this.currentUser || !this.isStorageAvailable()) {
      this.debug("No current user or not in browser environment, shouldn't attempt reconnect");
      return false;
    }
    
    // Always check if reconnection is blocked first
    if (this._isReconnectBlocked()) {
      this.debug("Reconnection is blocked by disconnect flags");
      return false;
    }
    
    try {
      // Check persisted connection state
      const stateData = this.getFromLocalStorage(this.CONNECTION_STATE_KEY);
      if (!stateData) {
        this.debug("No persisted connection state");
        return false;
      }
      
      const state = JSON.parse(stateData);
      
      // Verify state belongs to current user
      if (state.userId !== this.currentUser.uid) {
        this.debug("Persisted state belongs to different user");
        this.removeFromLocalStorage(this.CONNECTION_STATE_KEY);
        return false;
      }
      
      // Check if state is recent (within last 24 hours)
      const twentyFourHoursMs = 24 * 60 * 60 * 1000;
      if (Date.now() - state.timestamp > twentyFourHoursMs) {
        this.debug("Persisted state is too old");
        this.removeFromLocalStorage(this.CONNECTION_STATE_KEY);
        return false;
      }
      
      // Do another check for disconnect flags just to be safe
      if (this.getFromSessionStorage(this.DISCONNECT_SESSION_KEY) === 'true' ||
          this.getFromLocalStorage(this.DISCONNECT_FORCED_KEY) === 'true') {
        this.debug("Disconnect flags found, overriding persisted connected state");
        return false;
      }
      
      // If state indicates we were connected, attempt reconnect
      if (state.isConnected) {
        this.debug("Persisted state indicates previous connection, should attempt reconnect");
        return true;
      }
      
      this.debug("Persisted state indicates no previous connection");
      return false;
    } catch (error) {
      console.error("Error checking reconnect state:", error);
      this._lastError = error;
      return false;
    }
  }
  
  // Attempt to auto-reconnect using stored credentials
  public async autoReconnect(): Promise<{
    success: boolean;
    transactions?: Transaction[];
    error?: string;
  }> {
    this._lastReconnectAttempt = Date.now();
    this._reconnectAttemptsCount++;
    
    // Check if reconnection is blocked
    if (this.isReconnectBlocked()) {
      this.debug("Auto-reconnect blocked by previous disconnection");
      return {
        success: false,
        error: "Reconnection blocked"
      };
    }
    
    // Check if we should attempt reconnect
    if (!this.shouldAttemptReconnect()) {
      this.debug("Auto-reconnect not needed based on persisted state");
      return {
        success: false,
        error: "No previous connection"
      };
    }
    
    try {
      this.debug("Attempting auto-reconnect");
      
      // Get the stored access token
      const accessToken = this.getAccessToken();
      
      if (!accessToken) {
        this.debug("No stored access token found - cannot auto-reconnect");
        return {
          success: false,
          error: "No stored credentials"
        };
      }
      
      this.debug("Auto-reconnecting with stored access token");
      
      // Verify the access token is still valid by fetching transactions
      const transactions = await this.fetchTransactions(accessToken);
      
      // Update persisted state
      this.persistConnectionState(true, accessToken);
      
      // Clear any disconnection flags
      localStorage.removeItem(this.DISCONNECT_FORCED_KEY);
      localStorage.removeItem(this.DISCONNECT_TIMESTAMP_KEY);
      sessionStorage.removeItem(this.DISCONNECT_SESSION_KEY);
      
      this.debug("Auto-reconnect successful");
      return {
        success: true,
        transactions
      };
    } catch (error) {
      console.error("Auto-reconnect failed:", error);
      this._lastError = error;
      
      // Clear the stored token since it's invalid
      localStorage.removeItem(this.TOKEN_STORAGE_KEY);
      
      // Update persisted state
      this.persistConnectionState(false);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to reconnect"
      };
    }
  }
  
  // Enable or disable debug mode
  public setDebugMode(enabled: boolean): void {
    this._debugMode = enabled;
    
    if (enabled && typeof window !== 'undefined') {
      (window as any).__bankConnectionService = this;
      console.log('🔍 Bank connection service available for debugging as window.__bankConnectionService');
    }
  }
  
  // Reset reconnection blocks
  public resetReconnectionBlocks(): void {
    this.debug('Resetting reconnection blocks');
    
    if (!this.isStorageAvailable()) return;
    
    // Clear all reconnection blocks
    this.removeFromLocalStorage(this.DISCONNECT_FORCED_KEY);
    this.removeFromLocalStorage(this.DISCONNECT_TIMESTAMP_KEY);
    this.removeFromSessionStorage(this.DISCONNECT_SESSION_KEY);
    
    // Remove data attribute
    if (typeof document !== 'undefined') {
      document.documentElement.removeAttribute('data-bank-disconnected');
    }
  }
}

// Export singleton instance
export const bankConnectionService = BankConnectionService.getInstance(); 