/* eslint-disable @typescript-eslint/no-unused-vars */
import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './useAuth';

interface UseSocketOptions {
  url?: string;
  autoConnect?: boolean;
}

interface MessageData {
  senderId: string;
  message: string;
  conversationId: string;
  timestamp: Date;
}

interface TypingData {
  senderId: string;
  conversationId: string;
}

interface MessageStatusData {
  messageId: string;
  status: 'delivered' | 'read';
  timestamp: Date;
}

interface UseSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
  sendMessage: (recipientId: string, message: string, conversationId: string) => void;
  startTyping: (recipientId: string, conversationId: string) => void;
  stopTyping: (recipientId: string, conversationId: string) => void;
  markAsDelivered: (messageId: string, senderId: string) => void;
  markAsRead: (messageId: string, senderId: string) => void;
}

export const useSocket = (options: UseSocketOptions = {}): UseSocketReturn => {
  const { accessToken } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const socketUrl = options.url || process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3000';
  const autoConnect = options.autoConnect !== undefined ? options.autoConnect : true;

  const connect = useCallback(() => {
    if (!accessToken) return;
    
    // Initialize socket connection
    socketRef.current = io(socketUrl, {
      auth: {
        token: accessToken,
      },
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    // Socket event handlers
    socketRef.current.on('connect', () => {
      console.log('Socket connected');
      setIsConnected(true);
    });

    socketRef.current.on('disconnect', () => {
      console.log('Socket disconnected');
      setIsConnected(false);
    });

    socketRef.current.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      setIsConnected(false);
    });

  }, [accessToken, socketUrl]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    }
  }, []);

  useEffect(() => {
    if (autoConnect && accessToken && !socketRef.current) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [connect, disconnect, autoConnect, accessToken]);

  // Message sending
  const sendMessage = useCallback((recipientId: string, message: string, conversationId: string) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('message:send', {
        recipientId,
        message,
        conversationId,
      });
    }
  }, [isConnected]);

  // Typing indicators
  const startTyping = useCallback((recipientId: string, conversationId: string) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('typing:start', {
        recipientId,
        conversationId,
      });
    }
  }, [isConnected]);

  const stopTyping = useCallback((recipientId: string, conversationId: string) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('typing:stop', {
        recipientId,
        conversationId,
      });
    }
  }, [isConnected]);

  // Message status updates
  const markAsDelivered = useCallback((messageId: string, senderId: string) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('message:delivered', {
        messageId,
        senderId,
      });
    }
  }, [isConnected]);

  const markAsRead = useCallback((messageId: string, senderId: string) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('message:read', {
        messageId,
        senderId,
      });
    }
  }, [isConnected]);

  return {
    socket: socketRef.current,
    isConnected,
    connect,
    disconnect,
    sendMessage,
    startTyping,
    stopTyping,
    markAsDelivered,
    markAsRead,
  };
};

export default useSocket;