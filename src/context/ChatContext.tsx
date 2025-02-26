import React, { createContext, useState, useEffect, ReactNode, useCallback, useContext } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useSocket } from '../hooks/useSocket';

// Types
export interface Contact {
  id: string;
  contactId: string;
  name: string;
  email: string;
  avatar?: string;
  status?: string;
  nickname?: string;
  conversationId: string;
  lastMessage?: string;
  lastMessageTimestamp?: Date;
  unreadCount: number;
  isBlocked: boolean;
  isOnline: boolean;
  lastSeen?: Date;
}

export interface Message {
  id: string;
  sender: string;
  senderName?: string;
  senderAvatar?: string;
  recipient: string;
  conversationId: string;
  content: string;
  contentType: 'text' | 'image' | 'file' | 'audio';
  mediaUrl?: string;
  mediaType?: string;
  mediaName?: string;
  mediaSize?: number;
  isRead: boolean;
  timestamp: Date;
  status?: 'sent' | 'delivered' | 'read';
  expiresAt?: Date;
}

interface ChatContextType {
  contacts: Contact[];
  messages: Record<string, Message[]>;
  activeContact: Contact | null;
  loadingContacts: boolean;
  loadingMessages: boolean;
  typingUsers: Record<string, boolean>;
  setActiveContact: (contact: Contact | null) => void;
  getContacts: () => Promise<void>;
  getMessages: (conversationId: string) => Promise<void>;
  sendMessage: (
    content: string, 
    contentType?: 'text' | 'image' | 'file' | 'audio', 
    mediaUrl?: string, 
    mediaType?: string, 
    mediaName?: string, 
    mediaSize?: number
  ) => Promise<void>;
  markAsRead: (messageId: string, senderId: string) => void;
  startTyping: () => void;
  stopTyping: () => void;
}

const defaultContext: ChatContextType = {
  contacts: [],
  messages: {},
  activeContact: null,
  loadingContacts: false,
  loadingMessages: false,
  typingUsers: {},
  setActiveContact: () => {},
  getContacts: async () => {},
  getMessages: async () => {},
  sendMessage: async () => {},
  markAsRead: () => {},
  startTyping: () => {},
  stopTyping: () => {},
};

export const ChatContext = createContext<ChatContextType>(defaultContext);

interface ChatProviderProps {
  children: ReactNode;
}

export const ChatProvider: React.FC<ChatProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [activeContact, setActiveContact] = useState<Contact | null>(null);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Record<string, boolean>>({});
  
  const socket = useSocket();

  // Fetch contacts
  const getContacts = useCallback(async () => {
    if (!user) return;
    
    setLoadingContacts(true);
    
    try {
      const response = await fetch('/api/contacts');
      
      if (!response.ok) {
        throw new Error('Failed to fetch contacts');
      }
      
      const data = await response.json();
      setContacts(data.contacts);
    } catch (error) {
      console.error('Get contacts error:', error);
    } finally {
      setLoadingContacts(false);
    }
  }, [user]);

  // Fetch messages for a conversation
  const getMessages = useCallback(async (conversationId: string) => {
    if (!user) return;
    
    setLoadingMessages(true);
    
    try {
      const response = await fetch(`/api/messages?conversationId=${conversationId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch messages');
      }
      
      const data = await response.json();
      
      setMessages(prev => ({
        ...prev,
        [conversationId]: data.messages,
      }));
    } catch (error) {
      console.error('Get messages error:', error);
    } finally {
      setLoadingMessages(false);
    }
  }, [user]);

  // Send a message
  const sendMessage = async (
    content: string, 
    contentType: 'text' | 'image' | 'file' | 'audio' = 'text',
    mediaUrl?: string,
    mediaType?: string,
    mediaName?: string,
    mediaSize?: number
  ) => {
    if (!user || !activeContact) return;
    
    try {
      // Send to API
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipientId: activeContact.contactId,
          content,
          contentType,
          mediaUrl,
          mediaType,
          mediaName,
          mediaSize,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to send message');
      }
      
      const data = await response.json();
      
      // Add message to state
      const newMessage: Message = {
        id: data.message.id,
        sender: user.id,
        recipient: activeContact.contactId,
        conversationId: activeContact.conversationId,
        content,
        contentType,
        mediaUrl,
        mediaType,
        mediaName,
        mediaSize,
        isRead: false,
        timestamp: new Date(),
        status: 'sent',
      };
      
      setMessages(prev => {
        const conversationMessages = prev[activeContact.conversationId] || [];
        return {
          ...prev,
          [activeContact.conversationId]: [...conversationMessages, newMessage],
        };
      });
      
      // Send via socket for real-time delivery
      if (socket.isConnected) {
        socket.sendMessage(activeContact.contactId, content, activeContact.conversationId);
      }
      
      // Update contact's last message
      setContacts(prev => 
        prev.map(contact => 
          contact.id === activeContact.id
            ? {
                ...contact,
                lastMessage: content,
                lastMessageTimestamp: new Date(),
              }
            : contact
        )
      );
    } catch (error) {
      console.error('Send message error:', error);
      throw error;
    }
  };

  // Mark message as read
  const markAsRead = useCallback((messageId: string, senderId: string) => {
    if (!user || !activeContact) return;
    
    // Update local state
    setMessages(prev => {
      const updatedMessages = { ...prev };
      
      Object.keys(updatedMessages).forEach(conversationId => {
        updatedMessages[conversationId] = updatedMessages[conversationId].map(msg => 
          msg.id === messageId ? { ...msg, isRead: true, status: 'read' as const } : msg
        );
      });
      
      return updatedMessages;
    });
    
    // Send read status via socket
    if (socket.isConnected) {
      socket.markAsRead(messageId, senderId);
    }
  }, [socket, user, activeContact]);

  // Start typing indicator
  const startTyping = useCallback(() => {
    if (!user || !activeContact || !socket.isConnected) return;
    
    socket.startTyping(activeContact.contactId, activeContact.conversationId);
  }, [socket, user, activeContact]);

  // Stop typing indicator
  const stopTyping = useCallback(() => {
    if (!user || !activeContact || !socket.isConnected) return;
    
    socket.stopTyping(activeContact.contactId, activeContact.conversationId);
  }, [socket, user, activeContact]);

  // Socket event handlers
  useEffect(() => {
    if (!socket.socket || !user) return;
    
    // Handle receiving messages
    const handleReceiveMessage = (data: { 
      senderId: string; 
      message: string; 
      conversationId: string; 
      timestamp: Date 
    }) => {
      const { senderId, message, conversationId, timestamp } = data;
      
      // Find sender in contacts
      const sender = contacts.find(c => c.contactId === senderId);
      
      if (!sender) {
        // If we don't have this contact, refresh contacts
        getContacts();
        return;
      }
      
      // Create message object
      const newMessage: Message = {
        id: `temp-${Date.now()}`,
        sender: senderId,
        senderName: sender.name,
        senderAvatar: sender.avatar,
        recipient: user.id,
        conversationId,
        content: message,
        contentType: 'text',
        isRead: false,
        timestamp: new Date(timestamp),
      };
      
      // Add to messages
      setMessages(prev => {
        const conversationMessages = prev[conversationId] || [];
        return {
          ...prev,
          [conversationId]: [...conversationMessages, newMessage],
        };
      });
      
      // Update contact's last message
      setContacts(prev => 
        prev.map(contact => 
          contact.conversationId === conversationId
            ? {
                ...contact,
                lastMessage: message,
                lastMessageTimestamp: new Date(timestamp),
                unreadCount: contact.id === activeContact?.id ? 0 : contact.unreadCount + 1,
              }
            : contact
        )
      );
      
      // Mark as delivered
      if (socket.isConnected) {
        socket.markAsDelivered(newMessage.id, senderId);
      }
      
      // Mark as read if this is the active conversation
      if (activeContact?.conversationId === conversationId) {
        markAsRead(newMessage.id, senderId);
      }
    };
    
    // Handle typing indicators
    const handleTypingStart = (data: { senderId: string; conversationId: string }) => {
      setTypingUsers(prev => ({
        ...prev,
        [data.senderId]: true,
      }));
    };
    
    const handleTypingStop = (data: { senderId: string; conversationId: string }) => {
      setTypingUsers(prev => ({
        ...prev,
        [data.senderId]: false,
      }));
    };
    
    // Handle message status updates
    const handleMessageStatus = (data: { 
      messageId: string; 
      status: 'delivered' | 'read'; 
      timestamp: Date 
    }) => {
      const { messageId, status } = data;
      
      setMessages(prev => {
        const updatedMessages = { ...prev };
        
        Object.keys(updatedMessages).forEach(conversationId => {
          updatedMessages[conversationId] = updatedMessages[conversationId].map(msg => 
            msg.id === messageId ? { ...msg, status, isRead: status === 'read' } : msg
          );
        });
        
        return updatedMessages;
      });
    };
    
    // Handle online status
    const handleUserOnline = (data: { userId: string }) => {
      setContacts(prev => 
        prev.map(contact => 
          contact.contactId === data.userId
            ? { ...contact, isOnline: true }
            : contact
        )
      );
    };
    
    const handleUserOffline = (data: { userId: string }) => {
      setContacts(prev => 
        prev.map(contact => 
          contact.contactId === data.userId
            ? { ...contact, isOnline: false, lastSeen: new Date() }
            : contact
        )
      );
    };
    
    // Register event listeners
    socket.socket.on('message:receive', handleReceiveMessage);
    socket.socket.on('typing:start', handleTypingStart);
    socket.socket.on('typing:stop', handleTypingStop);
    socket.socket.on('message:status', handleMessageStatus);
    socket.socket.on('user:online', handleUserOnline);
    socket.socket.on('user:offline', handleUserOffline);
    
    // Cleanup
    return () => {
      socket.socket?.off('message:receive', handleReceiveMessage);
      socket.socket?.off('typing:start', handleTypingStart);
      socket.socket?.off('typing:stop', handleTypingStop);
      socket.socket?.off('message:status', handleMessageStatus);
      socket.socket?.off('user:online', handleUserOnline);
      socket.socket?.off('user:offline', handleUserOffline);
    };
  }, [socket, user, contacts, activeContact, getContacts, markAsRead]);

  // Load contacts when user is authenticated
  useEffect(() => {
    if (user) {
      getContacts();
    }
  }, [user, getContacts]);

  // Load messages when active contact changes
  useEffect(() => {
    if (activeContact) {
      getMessages(activeContact.conversationId);
    }
  }, [activeContact, getMessages]);

  const contextValue: ChatContextType = {
    contacts,
    messages,
    activeContact,
    loadingContacts,
    loadingMessages,
    typingUsers,
    setActiveContact,
    getContacts,
    getMessages,
    sendMessage,
    markAsRead,
    startTyping,
    stopTyping,
  };

  return (
    <ChatContext.Provider value={contextValue}>
      {children}
    </ChatContext.Provider>
  );
};

// Custom hook to use chat context
export const useChat = () => {
  const context = useContext(ChatContext);
  
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  
  return context;
};