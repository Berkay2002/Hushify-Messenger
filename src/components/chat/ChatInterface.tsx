/* eslint-disable jsx-a11y/alt-text */
/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Smile, Paperclip, Image } from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import MessageList from './MessageList';
import ChatHeader from './ChatHeader';
import { useEncryption } from '../../hooks/useEncryption';

const ChatInterface: React.FC = () => {
  const { activeContact, sendMessage, startTyping, stopTyping } = useChat();
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { encryptMessage } = useEncryption();
  const [isSending, setIsSending] = useState(false);

  // Handle sending messages
  const handleSendMessage = () => {
    if (!message.trim() || !activeContact || !user || isSending) return;

    setIsSending(true);
    
    // Encrypt and send in a non-rendering function
    const sendMessageAsync = async () => {
      try {
        // Encrypt the message before sending
        const encryptedContent = await encryptMessage(activeContact.contactId, message);
        
        // Send the encrypted message
        await sendMessage(encryptedContent);
        
        // Clear input
        setMessage('');
        
        // Stop typing indicator
        handleStopTyping();
      } catch (error) {
        console.error('Failed to send message:', error);
        // Show error to user
      } finally {
        setIsSending(false);
      }
    };
    
    // Call the async function
    sendMessageAsync();
  };

  // Handle typing indicator
  const handleTyping = () => {
    if (!isTyping) {
      setIsTyping(true);
      startTyping();
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing indicator after 1.5 seconds
    typingTimeoutRef.current = setTimeout(() => {
      handleStopTyping();
    }, 1500);
  };

  const handleStopTyping = () => {
    if (isTyping) {
      setIsTyping(false);
      stopTyping();
    }
  };

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Cleanup typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  if (!activeContact) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-gray-50">
        <div className="text-center p-8">
          <h3 className="text-xl font-medium text-gray-700 mb-2">Welcome to Hushify</h3>
          <p className="text-gray-500">
            Select a contact to start a secure conversation.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Chat header */}
      <ChatHeader contact={activeContact} />
      
      {/* Messages */}
      <MessageList />
      
      {/* Input area */}
      <div className="p-3 bg-white border-t border-gray-200">
        <div className="flex items-center">
          <button className="p-2 rounded-full hover:bg-gray-100 mr-1">
            <Smile className="h-5 w-5 text-gray-500" />
          </button>
          <button className="p-2 rounded-full hover:bg-gray-100 mr-1">
            <Paperclip className="h-5 w-5 text-gray-500" />
          </button>
          <button className="p-2 rounded-full hover:bg-gray-100 mr-2">
            <Image className="h-5 w-5 text-gray-500" />
          </button>
          
          <div className="flex-1 relative">
            <textarea
              placeholder="Type a message"
              className="w-full py-2 px-4 bg-gray-100 rounded-full focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none overflow-hidden"
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                handleTyping();
              }}
              onKeyDown={handleKeyPress}
              rows={1}
              style={{ maxHeight: '120px', minHeight: '40px' }}
              disabled={isSending}
            />
          </div>
          
          <button 
            className={`p-2 ml-2 rounded-full flex items-center justify-center ${
              message.trim() && !isSending
                ? 'bg-blue-600 text-white hover:bg-blue-700' 
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
            onClick={handleSendMessage}
            disabled={!message.trim() || isSending}
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;