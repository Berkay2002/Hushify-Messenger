// src/hooks/useSecureMessaging.ts
import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import encryptionService from '../lib/encryptionService';

export function useSecureMessaging() {
  const { user } = useAuth();
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initializationInProgress = useRef(false);

  // Initialize encryption once when the component mounts
  useEffect(() => {
    if (!user || initialized || initializationInProgress.current) return;
    
    const initEncryption = async () => {
      try {
        initializationInProgress.current = true;
        setError(null);
        await encryptionService.initializeKeys();
        setInitialized(true);
      } catch (err) {
        console.error('Failed to initialize encryption:', err);
        setError('Failed to initialize encryption');
      } finally {
        initializationInProgress.current = false;
      }
    };

    initEncryption();
  }, [user, initialized]);

  // Encrypt a message with proper error handling
  const encryptMessage = useCallback(async (userId: string, message: string) => {
    if (!initialized) {
      console.warn('Encryption not initialized, storing message unencrypted');
      return message;
    }

    try {
      return await encryptionService.prepareMessage(userId, message);
    } catch (err) {
      console.error('Encryption error:', err);
      setError('Failed to encrypt message');
      throw err;
    }
  }, [initialized]);

  // Decrypt a message with proper error handling
  const decryptMessage = useCallback(async (userId: string, encryptedMessage: string) => {
    if (!initialized) {
      console.warn('Encryption not initialized, cannot decrypt message');
      return encryptedMessage;
    }

    try {
      return await encryptionService.processMessage(userId, encryptedMessage);
    } catch (err) {
      console.error('Decryption error:', err);
      setError('Failed to decrypt message');
      throw err;
    }
  }, [initialized]);

  return {
    initialized,
    encryptMessage,
    decryptMessage,
    error
  };
}

export default useSecureMessaging;