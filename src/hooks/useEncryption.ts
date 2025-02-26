import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

interface EncryptionKeys {
  publicKey: JsonWebKey;
  privateKey: JsonWebKey;
}

interface SessionKey {
  key: JsonWebKey;
  iv: Uint8Array;
}

interface UseEncryptionReturn {
  initialized: boolean;
  encryptMessage: (userId: string, message: string) => Promise<string>;
  decryptMessage: (userId: string, encryptedMessage: string) => Promise<string>;
  exportPublicKey: () => Promise<string>;
  importContactPublicKey: (userId: string, publicKeyString: string) => Promise<void>;
}

// Store for keys and sessions
class KeyStore {
  private static instance: KeyStore;
  private myKeys: EncryptionKeys | null = null;
  private contactPublicKeys: Map<string, JsonWebKey> = new Map();
  private sessionKeys: Map<string, SessionKey> = new Map();

  private constructor() {}

  public static getInstance(): KeyStore {
    if (!KeyStore.instance) {
      KeyStore.instance = new KeyStore();
    }
    return KeyStore.instance;
  }

  public getMyKeys(): EncryptionKeys | null {
    return this.myKeys;
  }

  public setMyKeys(keys: EncryptionKeys): void {
    this.myKeys = keys;
  }

  public getContactPublicKey(userId: string): JsonWebKey | undefined {
    return this.contactPublicKeys.get(userId);
  }

  public setContactPublicKey(userId: string, key: JsonWebKey): void {
    this.contactPublicKeys.set(userId, key);
  }

  public getSessionKey(userId: string): SessionKey | undefined {
    return this.sessionKeys.get(userId);
  }

  public setSessionKey(userId: string, key: SessionKey): void {
    this.sessionKeys.set(userId, key);
  }
}

// Get singleton instance
const keyStore = KeyStore.getInstance();

// Generate keys for RSA-OAEP
async function generateEncryptionKeys(): Promise<EncryptionKeys> {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['encrypt', 'decrypt']
  );

  const publicKey = await window.crypto.subtle.exportKey('jwk', keyPair.publicKey);
  const privateKey = await window.crypto.subtle.exportKey('jwk', keyPair.privateKey);

  return { publicKey, privateKey };
}

// Generate session key
async function generateSessionKey(): Promise<SessionKey> {
  const key = await window.crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256,
    },
    true,
    ['encrypt', 'decrypt']
  );

  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const exportedKey = await window.crypto.subtle.exportKey('jwk', key);

  return { key: exportedKey, iv };
}

// Utility to convert between string and ArrayBuffer
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary_string = atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
}

export function useEncryption(): UseEncryptionReturn {
  const { user } = useAuth();
  const [initialized, setInitialized] = useState(false);

  // Initialize encryption
  useEffect(() => {
    async function initializeEncryption() {
      if (!user) return;

      try {
        // Check if we already have keys
        if (!keyStore.getMyKeys()) {
          // Generate new keys
          const keys = await generateEncryptionKeys();
          keyStore.setMyKeys(keys);

          // Store public key on server
          await fetch('/api/encryption/keys', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              publicKey: JSON.stringify(keys.publicKey),
            }),
          });
        }

        setInitialized(true);
      } catch (error) {
        console.error('Encryption initialization error:', error);
      }
    }

    initializeEncryption();
  }, [user]);

  // Export public key as string
  const exportPublicKey = async (): Promise<string> => {
    const myKeys = keyStore.getMyKeys();
    if (!myKeys) {
      throw new Error('Encryption keys not initialized');
    }

    return JSON.stringify(myKeys.publicKey);
  };

  // Import a contact's public key
  const importContactPublicKey = async (userId: string, publicKeyString: string): Promise<void> => {
    try {
      const publicKey = JSON.parse(publicKeyString) as JsonWebKey;
      keyStore.setContactPublicKey(userId, publicKey);
    } catch (error) {
      console.error('Failed to import public key:', error);
      throw new Error('Invalid public key format');
    }
  };

  // Ensure we have a session key for a user
  const ensureSessionKey = async (userId: string): Promise<SessionKey> => {
    let sessionKey = keyStore.getSessionKey(userId);

    if (!sessionKey) {
      // Generate new session key
      sessionKey = await generateSessionKey();
      keyStore.setSessionKey(userId, sessionKey);

      // TODO: Exchange session key with contact via encrypted channel
      // For now, we'll just use it locally
    }

    return sessionKey;
  };

  // Encrypt a message
  const encryptMessage = async (userId: string, message: string): Promise<string> => {
    if (!initialized) {
      throw new Error('Encryption not initialized');
    }

    try {
      // Ensure we have a session key
      const sessionKey = await ensureSessionKey(userId);

      // Import the session key
      const cryptoKey = await window.crypto.subtle.importKey(
        'jwk',
        sessionKey.key,
        {
          name: 'AES-GCM',
          length: 256,
        },
        false,
        ['encrypt']
      );

      // Encrypt the message
      const encodedMessage = new TextEncoder().encode(message);
      const encryptedData = await window.crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: sessionKey.iv,
        },
        cryptoKey,
        encodedMessage
      );

      // Combine IV and encrypted data into a single string
      const encryptedBase64 = arrayBufferToBase64(encryptedData);
      const ivBase64 = arrayBufferToBase64(sessionKey.iv.buffer.slice(0) as ArrayBuffer);

      return JSON.stringify({
        iv: ivBase64,
        data: encryptedBase64,
      });
    } catch (error) {
      console.error('Message encryption error:', error);
      throw new Error('Failed to encrypt message');
    }
  };

  // Decrypt a message
  const decryptMessage = async (userId: string, encryptedMessage: string): Promise<string> => {
    if (!initialized) {
      throw new Error('Encryption not initialized');
    }

    try {
      // Parse the encrypted message
      const { iv, data } = JSON.parse(encryptedMessage);

      // Get the session key
      const sessionKey = keyStore.getSessionKey(userId);
      if (!sessionKey) {
        throw new Error('No session key available for this user');
      }

      // Import the session key
      const cryptoKey = await window.crypto.subtle.importKey(
        'jwk',
        sessionKey.key,
        {
          name: 'AES-GCM',
          length: 256,
        },
        false,
        ['decrypt']
      );

      // Decrypt the message
      const encryptedData = base64ToArrayBuffer(data);
      const ivData = base64ToArrayBuffer(iv);
      
      const decryptedData = await window.crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: new Uint8Array(ivData),
        },
        cryptoKey,
        encryptedData
      );

      return new TextDecoder().decode(decryptedData);
    } catch (error) {
      console.error('Message decryption error:', error);
      throw new Error('Failed to decrypt message');
    }
  };

  return {
    initialized,
    encryptMessage,
    decryptMessage,
    exportPublicKey,
    importContactPublicKey,
  };
}