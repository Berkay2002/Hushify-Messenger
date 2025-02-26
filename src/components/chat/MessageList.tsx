import React, { useEffect, useRef } from 'react';
import { Lock } from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import { useEncryption } from '../../hooks/useEncryption';

const MessageList: React.FC = () => {
  const { activeContact, messages, loadingMessages, typingUsers, markAsRead } = useChat();
  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { decryptMessage } = useEncryption();
  
  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeContact?.id]);
  
  if (!activeContact) return null;
  
  const conversationMessages = messages[activeContact.conversationId] || [];
  const isTyping = typingUsers[activeContact.contactId];
  
  // Group messages by date
  
interface Message {
    id: string;
    sender: string;
    recipient: string;
    conversationId: string;
    content: string;
    contentType: 'text' | 'image' | 'file' | 'audio';
    timestamp: Date;
    isRead: boolean;
    status?: 'read' | 'delivered' | 'sent';
}

interface GroupedMessages {
    [date: string]: Message[];
}

const groupedMessages: GroupedMessages = {};

conversationMessages.forEach((message: Message) => {
    const date = new Date(message.timestamp).toLocaleDateString();
    if (!groupedMessages[date]) {
        groupedMessages[date] = [];
    }
    groupedMessages[date].push(message);
    
    // Mark unread messages as read
    if (message.sender === activeContact.contactId && !message.isRead) {
        markAsRead(message.id, message.sender);
    }
});
  
  // Decrypt message content
  const getDecryptedContent = async (message: typeof conversationMessages[0]) => {
    if (message.sender === user?.id) {
      // It's our message, we already know the content
      return message.content;
    }
    
    try {
      // Try to decrypt the message
      return await decryptMessage(message.sender, message.content);
    } catch (error) {
      console.error('Failed to decrypt message:', error);
      return '[Encrypted message - unable to decrypt]';
    }
  };

  if (loadingMessages) {
    return (
      <div className="flex-1 p-4 overflow-y-auto bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading messages...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 overflow-y-auto bg-gray-50">
      {/* Encryption notice */}
      <div className="flex justify-center mb-6">
        <div className="flex items-center text-xs text-gray-500">
          <Lock className="h-3 w-3 mr-1" />
          Messages are end-to-end encrypted. No one outside this chat can read them.
        </div>
      </div>
      
      {/* No messages yet */}
      {conversationMessages.length === 0 && (
        <div className="flex justify-center">
          <div className="bg-white p-4 rounded-lg shadow-sm text-center">
            <p className="text-gray-600">No messages yet.</p>
            <p className="text-gray-500 text-sm mt-1">Send a message to start the conversation!</p>
          </div>
        </div>
      )}
      
      {/* Messages by date */}
      {Object.entries(groupedMessages).map(([date, dateMessages]) => (
        <div key={date} className="mb-4">
          <div className="flex justify-center mb-4">
            <div className="bg-gray-200 text-gray-600 text-xs py-1 px-3 rounded-full">
              {date === new Date().toLocaleDateString() ? 'Today' : date}
            </div>
          </div>
          
          {dateMessages.map((message) => (
            <div
              key={message.id}
              className={`flex mb-4 ${message.sender === user?.id ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs md:max-w-md py-2 px-4 rounded-lg ${
                  message.sender === user?.id
                    ? 'bg-blue-600 text-white rounded-br-none'
                    : 'bg-white text-gray-800 rounded-bl-none shadow'
                }`}
              >
                <p>{getDecryptedContent(message)}</p>
                <div className={`text-xs mt-1 flex items-center justify-end ${
                  message.sender === user?.id ? 'text-blue-100' : 'text-gray-500'
                }`}>
                  {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {message.sender === user?.id && (
                    <span className="ml-1">
                      {message.status === 'read' ? (
                        <svg className="h-3 w-3 fill-current" viewBox="0 0 16 15">
                          <path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-.358-.325a.319.319 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.125.484-.033l6.272-8.048a.366.366 0 0 0-.064-.512zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.879a.32.32 0 0 1-.484.033L1.891 7.769a.366.366 0 0 0-.515.006l-.423.433a.364.364 0 0 0 .006.514l3.258 3.185c.143.14.361.125.484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z" />
                        </svg>
                      ) : message.status === 'delivered' ? (
                        <svg className="h-3 w-3 fill-current" viewBox="0 0 16 15">
                          <path d="M10.91 3.316l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.879a.32.32 0 0 1-.484.033L1.891 7.769a.366.366 0 0 0-.515.006l-.423.433a.364.364 0 0 0 .006.514l3.258 3.185c.143.14.361.125.484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z" />
                        </svg>
                      ) : (
                        <svg className="h-3 w-3 fill-current" viewBox="0 0 16 15">
                          <path d="M10.91 3.316l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.879a.32.32 0 0 1-.484.033L1.891 7.769a.366.366 0 0 0-.515.006l-.423.433a.364.364 0 0 0 .006.514l3.258 3.185c.143.14.361.125.484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z" />
                        </svg>
                      )}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}
      
      {/* Typing indicator */}
      {isTyping && (
        <div className="flex mb-4 justify-start">
          <div className="bg-white p-3 rounded-lg shadow-sm">
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '200ms' }}></div>
              <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '400ms' }}></div>
            </div>
          </div>
        </div>
      )}
      
      {/* Invisible element to scroll to */}
      <div ref={messagesEndRef} />
    </div>
  );
};

export default MessageList;