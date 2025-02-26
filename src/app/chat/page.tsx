'use client';

import React, { useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Lock, User, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ChatProvider } from '../../context/ChatContext';
import ContactList from '../../components/chat/ContactList';
import ChatInterface from '../../components/chat/ChatInterface';

const ChatPage = () => {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <ChatProvider>
      <div className="flex h-screen bg-gray-100">
        {/* Sidebar */}
        <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
          {/* App header */}
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center">
              <div className="h-8 w-8 bg-blue-600 rounded-full flex items-center justify-center mr-2">
                <Lock className="h-4 w-4 text-white" />
              </div>
              <h1 className="text-xl font-bold">Hushify</h1>
            </div>
            <button 
              onClick={logout}
              className="p-2 rounded-full hover:bg-gray-100"
              title="Logout"
            >
              <LogOut className="h-5 w-5 text-gray-500" />
            </button>
          </div>
          
          {/* Contacts list */}
          <div className="flex-1 overflow-y-auto">
            <ContactList />
          </div>
          
          {/* User profile */}
          <div className="p-3 border-t border-gray-200 flex items-center">
            <Image 
              src={user.avatar || '/api/placeholder/40/40'}
              alt="Your avatar" 
              width={40}
              height={40}
              className="h-10 w-10 rounded-full mr-3"
            />
            <div className="flex-1">
              <h3 className="font-medium">{user.name}</h3>
              <p className="text-xs text-gray-500">{user.status || 'Available'}</p>
            </div>
            <button className="p-2 rounded-full hover:bg-gray-100">
              <User className="h-5 w-5 text-gray-500" />
            </button>
          </div>
        </div>
        
        {/* Chat area */}
        <ChatInterface />
      </div>
    </ChatProvider>
  );
};

export default ChatPage;