/**
 * A simpler encryption system using the Web Crypto API
 * This provides basic end-to-end encryption without the complexity of Signal Protocol
 */

// Key types
export interface KeyPair {
  publicKey: JsonWebKey;
  privateKey: JsonWebKey;
}

// Store for keys and sessions
class CryptoStore {
  private static instance: CryptoStore;
  private myKeyPair: KeyPair | null = null;
  private otherPublicKeys: Map<string, JsonWebKey> = new Map();
  private sessionKeys: Map<string, JsonWebKey> = new Map();

  private constructor() {}

  public static getInstance(): CryptoStore {
    if (!CryptoStore.instance) {
      CryptoStore.instance = new CryptoStore();
    }
    return CryptoStore.instance;
  }

  // Get my key pair
  public getMyKeyPair(): KeyPair | null {
    return this.myKeyPair;
  }

  // Set my key pair
  public setMyKeyPair(keyPair: KeyPair): void {
    this.myKeyPair = keyPair;
  }

  // Store someone else's public key
  public storePublicKey(userId: string, publicKey: JsonWebKey): void {
    this.otherPublicKeys.set(userId, publicKey);
  }

  // Get someone's public key
  public getPublicKey(userId: string): JsonWebKey | undefined {
    return this.otherPublicKeys.get(userId);
  }

  // Store a session key for a conversation
  public storeSessionKey(conversationId: string, sessionKey: JsonWebKey): void {
    this.sessionKeys.set(conversationId, sessionKey);
  }

  // Get a session key for a conversation
  public getSessionKey(conversationId: string): JsonWebKey | undefined {
    return this.sessionKeys.get(conversationId);
  }
}

export const cryptoStore = CryptoStore.getInstance();

/**
 * Generate a new RSA key pair for the current user
 */
export async function generateKeyPair(): Promise<KeyPair> {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true, // extractable
    ["encrypt", "decrypt"]
  );

  // Export keys to JWK format
  const publicKey = await window.crypto.subtle.exportKey(
    "jwk",
    keyPair.publicKey
  );

  const privateKey = await window.crypto.subtle.exportKey(
    "jwk", 
    keyPair.privateKey
  );

  const result = { publicKey, privateKey };
  cryptoStore.setMyKeyPair(result);
  return result;
}

/**
 * Generate a session key for a conversation
 */
export async function generateSessionKey(conversationId: string): Promise<JsonWebKey> {
  const key = await window.crypto.subtle.generateKey(
    {
      name: "AES-GCM",
      length: 256,
    },
    true, // extractable
    ["encrypt", "decrypt"]
  );

  const sessionKey = await window.crypto.subtle.exportKey("jwk", key);
  cryptoStore.storeSessionKey(conversationId, sessionKey);
  return sessionKey;
}

/**
 * Encrypt a session key using recipient's public key
 */
export async function encryptSessionKey(
  recipientId: string,
  sessionKey: JsonWebKey
): Promise<string> {
  const recipientPublicKey = cryptoStore.getPublicKey(recipientId);
  
  if (!recipientPublicKey) {
    throw new Error(`Public key not found for user ${recipientId}`);
  }

  // Import recipient's public key
  const publicKey = await window.crypto.subtle.importKey(
    "jwk",
    recipientPublicKey,
    {
      name: "RSA-OAEP",
      hash: "SHA-256",
    },
    false, // not extractable
    ["encrypt"]
  );

  // Convert session key to binary format
  const sessionKeyData = new TextEncoder().encode(JSON.stringify(sessionKey));

  // Encrypt the session key with the recipient's public key
  const encryptedData = await window.crypto.subtle.encrypt(
    {
      name: "RSA-OAEP",
    },
    publicKey,
    sessionKeyData
  );

  // Convert to base64 string for transmission
  return arrayBufferToBase64(encryptedData);
}

/**
 * Decrypt a session key using our private key
 */
export async function decryptSessionKey(
  encryptedSessionKey: string
): Promise<JsonWebKey> {
  const myKeyPair = cryptoStore.getMyKeyPair();
  
  if (!myKeyPair) {
    throw new Error("No key pair available");
  }

  // Import my private key
  const privateKey = await window.crypto.subtle.importKey(
    "jwk",
    myKeyPair.privateKey,
    {
      name: "RSA-OAEP",
      hash: "SHA-256",
    },
    false, // not extractable
    ["decrypt"]
  );

  // Decrypt the session key
  const sessionKeyData = await window.crypto.subtle.decrypt(
    {
      name: "RSA-OAEP",
    },
    privateKey,
    base64ToArrayBuffer(encryptedSessionKey)
  );

  // Parse the decrypted data
  const sessionKey = JSON.parse(new TextDecoder().decode(sessionKeyData));
  return sessionKey;
}

/**
 * Encrypt a message using the session key
 */
export async function encryptMessage(
  conversationId: string,
  message: string
): Promise<{ encrypted: string; iv: string }> {
  const sessionKey = cryptoStore.getSessionKey(conversationId);
  
  if (!sessionKey) {
    throw new Error(`Session key not found for conversation ${conversationId}`);
  }

  // Import the session key
  const key = await window.crypto.subtle.importKey(
    "jwk",
    sessionKey,
    {
      name: "AES-GCM",
      length: 256,
    },
    false, // not extractable
    ["encrypt"]
  );

  // Generate a random IV
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  // Encrypt the message
  const encryptedData = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    key,
    new TextEncoder().encode(message)
  );

  return {
    encrypted: arrayBufferToBase64(encryptedData),
    iv: arrayBufferToBase64(iv.buffer),
  };
}

/**
 * Decrypt a message using the session key
 */
export async function decryptMessage(
  conversationId: string,
  encryptedData: string,
  iv: string
): Promise<string> {
  const sessionKey = cryptoStore.getSessionKey(conversationId);
  
  if (!sessionKey) {
    throw new Error(`Session key not found for conversation ${conversationId}`);
  }

  // Import the session key
  const key = await window.crypto.subtle.importKey(
    "jwk",
    sessionKey,
    {
      name: "AES-GCM",
      length: 256,
    },
    false, // not extractable
    ["decrypt"]
  );

  // Decrypt the message
  const decryptedData = await window.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: base64ToArrayBuffer(iv),
    },
    key,
    base64ToArrayBuffer(encryptedData)
  );

  return new TextDecoder().decode(decryptedData);
}

// Utility to convert ArrayBuffer to Base64 string
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Utility to convert Base64 string to ArrayBuffer
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary_string = atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
}