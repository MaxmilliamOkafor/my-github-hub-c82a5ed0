// QuantumHire AI - Encrypted Storage Manager
// Securely stores sensitive profile data with encryption

const EncryptedStorage = {
  // Encryption key derivation salt (per-installation unique)
  saltKey: 'quantumhire_salt_v1',
  
  /**
   * Generate or retrieve installation-specific salt
   */
  async getSalt() {
    const data = await chrome.storage.local.get([this.saltKey]);
    
    if (data[this.saltKey]) {
      return new Uint8Array(data[this.saltKey]);
    }
    
    // Generate new random salt
    const salt = crypto.getRandomValues(new Uint8Array(16));
    await chrome.storage.local.set({ [this.saltKey]: Array.from(salt) });
    
    return salt;
  },

  /**
   * Derive encryption key from a passphrase
   */
  async deriveKey(passphrase) {
    const salt = await this.getSalt();
    
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(passphrase),
      'PBKDF2',
      false,
      ['deriveKey']
    );
    
    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  },

  /**
   * Get a device-specific passphrase
   * Uses installation ID as base for encryption
   */
  async getDevicePassphrase() {
    const data = await chrome.storage.local.get(['deviceId']);
    
    if (data.deviceId) {
      return data.deviceId;
    }
    
    // Generate unique device ID
    const deviceId = `qh_${Date.now()}_${crypto.randomUUID()}`;
    await chrome.storage.local.set({ deviceId });
    
    return deviceId;
  },

  /**
   * Encrypt data
   */
  async encrypt(data) {
    try {
      const passphrase = await this.getDevicePassphrase();
      const key = await this.deriveKey(passphrase);
      
      const encoder = new TextEncoder();
      const plaintext = encoder.encode(JSON.stringify(data));
      
      // Generate random IV
      const iv = crypto.getRandomValues(new Uint8Array(12));
      
      const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        plaintext
      );
      
      // Combine IV and ciphertext
      const combined = new Uint8Array(iv.length + ciphertext.byteLength);
      combined.set(iv, 0);
      combined.set(new Uint8Array(ciphertext), iv.length);
      
      // Convert to base64 for storage
      return btoa(String.fromCharCode(...combined));
    } catch (error) {
      console.error('QuantumHire AI: Encryption error', error);
      throw error;
    }
  },

  /**
   * Decrypt data
   */
  async decrypt(encryptedBase64) {
    try {
      const passphrase = await this.getDevicePassphrase();
      const key = await this.deriveKey(passphrase);
      
      // Decode from base64
      const combined = new Uint8Array(
        atob(encryptedBase64).split('').map(c => c.charCodeAt(0))
      );
      
      // Extract IV and ciphertext
      const iv = combined.slice(0, 12);
      const ciphertext = combined.slice(12);
      
      const plaintext = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        ciphertext
      );
      
      const decoder = new TextDecoder();
      return JSON.parse(decoder.decode(plaintext));
    } catch (error) {
      console.error('QuantumHire AI: Decryption error', error);
      throw error;
    }
  },

  /**
   * Securely store profile data
   */
  async setSecureProfile(profile) {
    const encrypted = await this.encrypt(profile);
    await chrome.storage.local.set({ 
      secureProfile: encrypted,
      profileUpdatedAt: Date.now(),
    });
    
    // Also keep a plain version for quick access (non-sensitive fields only)
    const publicFields = {
      first_name: profile.first_name,
      last_name: profile.last_name,
      hasProfile: true,
      updatedAt: Date.now(),
    };
    await chrome.storage.local.set({ profileMeta: publicFields });
    
    console.log('QuantumHire AI: Profile encrypted and stored securely');
  },

  /**
   * Retrieve secure profile data
   */
  async getSecureProfile() {
    const data = await chrome.storage.local.get(['secureProfile']);
    
    if (!data.secureProfile) {
      return null;
    }
    
    try {
      return await this.decrypt(data.secureProfile);
    } catch (error) {
      console.error('QuantumHire AI: Failed to decrypt profile', error);
      return null;
    }
  },

  /**
   * Store ATS credentials securely
   */
  async setSecureCredentials(platform, credentials) {
    const data = await chrome.storage.local.get(['secureCredentials']);
    const allCreds = data.secureCredentials ? 
      await this.decrypt(data.secureCredentials) : {};
    
    allCreds[platform] = {
      ...credentials,
      storedAt: Date.now(),
    };
    
    const encrypted = await this.encrypt(allCreds);
    await chrome.storage.local.set({ secureCredentials: encrypted });
    
    console.log(`QuantumHire AI: ${platform} credentials stored securely`);
  },

  /**
   * Retrieve ATS credentials
   */
  async getSecureCredentials(platform) {
    const data = await chrome.storage.local.get(['secureCredentials']);
    
    if (!data.secureCredentials) {
      return null;
    }
    
    try {
      const allCreds = await this.decrypt(data.secureCredentials);
      return platform ? allCreds[platform] : allCreds;
    } catch (error) {
      console.error('QuantumHire AI: Failed to decrypt credentials', error);
      return null;
    }
  },

  /**
   * Clear all secure storage
   */
  async clearAll() {
    await chrome.storage.local.remove([
      'secureProfile',
      'secureCredentials',
      'profileMeta',
      'profileUpdatedAt',
    ]);
    console.log('QuantumHire AI: Secure storage cleared');
  },

  /**
   * Check if crypto is available
   */
  isSupported() {
    return typeof crypto !== 'undefined' && 
           typeof crypto.subtle !== 'undefined' &&
           typeof crypto.subtle.encrypt === 'function';
  },
};

// Export for use in extension
if (typeof window !== 'undefined') {
  window.QuantumHireEncryptedStorage = EncryptedStorage;
}
