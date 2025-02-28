import nacl from 'tweetnacl';
import util from 'tweetnacl-util';

// Types
export interface KeyPair {
  publicKey: string; // Base64 encoded
  secretKey: string; // Base64 encoded
}

export interface EncryptedMessage {
  ciphertext: string; // Base64 encoded
  nonce: string;     // Base64 encoded
}

// Key Storage
class KeyStorage {
  private static instance: KeyStorage;
  private myKeyPair: KeyPair | null = null;
  private contactPublicKeys: Map<string, string> = new Map();
  private sharedSecrets: Map<string, Uint8Array> = new Map();

  private constructor() {}

  public static getInstance(): KeyStorage {
    if (!KeyStorage.instance) {
      KeyStorage.instance = new KeyStorage();
    }
    return KeyStorage.instance;
  }

  // Store my key pair
  public setMyKeyPair(keyPair: KeyPair): void {
    this.myKeyPair = keyPair;
  }

  // Get my key pair
  public getMyKeyPair(): KeyPair | null {
    return this.myKeyPair;
  }

  // Store a contact's public key
  public setContactPublicKey(userId: string, publicKey: string): void {
    this.contactPublicKeys.set(userId, publicKey);
    // Compute and store shared secret when we get a new public key
    this.computeSharedSecret(userId);
  }

  // Get a contact's public key
  public getContactPublicKey(userId: string): string | undefined {
    return this.contactPublicKeys.get(userId);
  }

  // Compute shared secret for a contact
  private computeSharedSecret(userId: string): void {
    const contactPublicKey = this.contactPublicKeys.get(userId);
    const myKeyPair = this.myKeyPair;
    
    if (!contactPublicKey || !myKeyPair) {
      console.log(`Cannot compute shared secret: missing keys for user ${userId}`);
      return;
    }

    try {
      // For actual NaCl keys - convert from Base64
      let publicKeyBinary: Uint8Array;
      let secretKeyBinary: Uint8Array;

      try {
        publicKeyBinary = util.decodeBase64(contactPublicKey);
        secretKeyBinary = util.decodeBase64(myKeyPair.secretKey);
      } catch (error) {
        console.error('Failed to decode keys from Base64:', error);
        return;
      }

      // Verify key lengths
      if (publicKeyBinary.length !== nacl.box.publicKeyLength || 
          secretKeyBinary.length !== nacl.box.secretKeyLength) {
        console.error('Invalid key length', {
          publicKeyLength: publicKeyBinary.length,
          secretKeyLength: secretKeyBinary.length,
          expectedPublicKeyLength: nacl.box.publicKeyLength,
          expectedSecretKeyLength: nacl.box.secretKeyLength
        });
        return;
      }

      // Compute shared secret using X25519
      const sharedSecret = nacl.box.before(
        publicKeyBinary,
        secretKeyBinary
      );
      this.sharedSecrets.set(userId, sharedSecret);
      console.log(`Shared secret computed successfully for user ${userId}`);
    } catch (error) {
      console.error('Failed to compute shared secret:', error);
    }
  }

  // Get shared secret for a contact
  public getSharedSecret(userId: string): Uint8Array | undefined {
    return this.sharedSecrets.get(userId);
  }

  // Clear all stored keys (for logout)
  public clear(): void {
    this.myKeyPair = null;
    this.contactPublicKeys.clear();
    this.sharedSecrets.clear();
  }
}

// Encryption Functions
export const encryptionService = {
  // Generate a new key pair
  generateKeyPair: (): KeyPair => {
    try {
      const keyPair = nacl.box.keyPair();
      const result = {
        publicKey: util.encodeBase64(keyPair.publicKey),
        secretKey: util.encodeBase64(keyPair.secretKey)
      };
      console.log('Generated new encryption key pair');
      return result;
    } catch (error) {
      console.error('Failed to generate key pair:', error);
      throw new Error('Failed to generate encryption keys');
    }
  },

  // Initialize user's keys (call this at login/startup)
  initializeKeys: async (): Promise<KeyPair> => {
    const storage = KeyStorage.getInstance();
    let keyPair = storage.getMyKeyPair();

    // If we already have keys, return them
    if (keyPair) {
      console.log('Using existing encryption keys');
      return keyPair;
    }

    // Otherwise generate new keys
    console.log('Generating new encryption keys');
    keyPair = encryptionService.generateKeyPair();
    storage.setMyKeyPair(keyPair);

    // In a real app, you would post the public key to the server here
    try {
      console.log('Saving public key to server');
      const response = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publicKey: keyPair.publicKey
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Failed to save public key:', errorData);
      } else {
        console.log('Public key saved successfully');
      }
    } catch (error) {
      console.error('Failed to save public key to server:', error);
    }

    return keyPair;
  },

  // Store a contact's public key
  storeContactPublicKey: (userId: string, publicKey: string): void => {
    console.log(`Storing public key for user ${userId}`);
    const storage = KeyStorage.getInstance();
    storage.setContactPublicKey(userId, publicKey);
  },

// Fetch a contact's public key from the server
fetchContactPublicKey: async (userId: string): Promise<string> => {
    const storage = KeyStorage.getInstance();
    const cachedPublicKey = storage.getContactPublicKey(userId);
  
    // If we already have the public key, return it
    if (cachedPublicKey) {
      console.log(`Using cached public key for user ${userId}`);
      return cachedPublicKey;
    }
  
    console.log(`Fetching public key for user ${userId}`);
    
    // Otherwise fetch from server
    try {
      const response = await fetch(`/api/keys/${userId}`);
      
      if (!response.ok) {
        let errorMessage = 'Failed to fetch public key';
        try {
          const errorData = await response.json();
          console.error('Public key fetch failed:', errorData);
          errorMessage = errorData.error || errorMessage;
        } catch (parseError) {
          console.error('Error parsing error response:', parseError);
        }
        
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      
      // Explicitly check that publicKey exists and is a string
      if (!data.publicKey || typeof data.publicKey !== 'string') {
        console.error('Invalid public key in response:', data);
        throw new Error('No valid public key returned from server');
      }
      
      // Create a new string variable to avoid type confusion
      const retrievedPublicKey: string = data.publicKey;
      console.log(`Retrieved public key for user ${userId}`);
  
      // Store it for future use
      storage.setContactPublicKey(userId, retrievedPublicKey);
      return retrievedPublicKey;
    } catch (error) {
      console.error('Failed to fetch public key:', error);
      
      // Generate a temporary placeholder key for development/testing
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`DEVELOPMENT MODE: Using temporary placeholder key for user ${userId}`);
        
        // Generate a valid key pair to use as a placeholder
        const tempKeyPair = nacl.box.keyPair();
        const tempPublicKey = util.encodeBase64(tempKeyPair.publicKey);
        
        storage.setContactPublicKey(userId, tempPublicKey);
        return tempPublicKey;
      }
      
      throw error;
    }
  },

  // Encrypt a message for a specific contact
  encryptMessage: async (userId: string, message: string): Promise<EncryptedMessage> => {
    const storage = KeyStorage.getInstance();
    
    // Make sure we have the contact's public key
    const publicKey = storage.getContactPublicKey(userId);
    if (!publicKey) {
      console.log(`No public key found for user ${userId}, fetching...`);
      await encryptionService.fetchContactPublicKey(userId);
    }

    // Get shared secret
    const sharedSecret = storage.getSharedSecret(userId);
    if (!sharedSecret) {
      console.error(`No shared secret available for user ${userId}`);
      throw new Error('No shared secret available for this contact');
    }

    try {
      // Generate random nonce
      const nonce = nacl.randomBytes(nacl.box.nonceLength);
      
      // Encrypt the message
      const messageUint8 = util.decodeUTF8(message);
      const encrypted = nacl.box.after(messageUint8, nonce, sharedSecret);

      // Return the encrypted message and nonce
      return {
        ciphertext: util.encodeBase64(encrypted),
        nonce: util.encodeBase64(nonce)
      };
    } catch (error) {
      console.error('Message encryption error:', error);
      throw new Error('Failed to encrypt message');
    }
  },

  // Decrypt a message from a specific contact
  decryptMessage: async (userId: string, encryptedMessage: EncryptedMessage): Promise<string> => {
    const storage = KeyStorage.getInstance();
    
    // Make sure we have the contact's public key
    const publicKey = storage.getContactPublicKey(userId);
    if (!publicKey) {
      console.log(`No public key found for user ${userId}, fetching...`);
      await encryptionService.fetchContactPublicKey(userId);
    }

    // Get shared secret
    const sharedSecret = storage.getSharedSecret(userId);
    if (!sharedSecret) {
      console.error(`No shared secret available for user ${userId}`);
      throw new Error('No shared secret available for this contact');
    }

    try {
      // Decode the encrypted message and nonce
      const ciphertext = util.decodeBase64(encryptedMessage.ciphertext);
      const nonce = util.decodeBase64(encryptedMessage.nonce);

      // Decrypt the message
      const decrypted = nacl.box.open.after(ciphertext, nonce, sharedSecret);
      if (!decrypted) {
        throw new Error('Failed to decrypt message');
      }

      // Return the decrypted message
      return util.encodeUTF8(decrypted);
    } catch (error) {
      console.error('Message decryption error:', error);
      throw new Error('Failed to decrypt message');
    }
  },

  // Prepare message for sending (combines encryption with JSON formatting)
  prepareMessage: async (userId: string, message: string): Promise<string> => {
    console.log(`Preparing message for user ${userId}`);
    try {
      const encrypted = await encryptionService.encryptMessage(userId, message);
      return JSON.stringify(encrypted);
    } catch (error) {
      console.error('Failed to prepare message:', error);
      throw error;
    }
  },

  // Process received message (combines JSON parsing with decryption)
  processMessage: async (userId: string, encryptedJson: string): Promise<string> => {
    console.log(`Processing message from user ${userId}`);
    try {
      const encrypted = JSON.parse(encryptedJson) as EncryptedMessage;
      return await encryptionService.decryptMessage(userId, encrypted);
    } catch (error) {
      console.error('Failed to process message:', error);
      throw new Error('Invalid message format');
    }
  },

  // Clear all keys (for logout)
  clearKeys: (): void => {
    console.log('Clearing all encryption keys');
    const storage = KeyStorage.getInstance();
    storage.clear();
  }
};

export default encryptionService;