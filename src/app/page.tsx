'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Shield, MessageCircle } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '../hooks/useAuth';

const HomePage = () => {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Redirect authenticated users to chat
  useEffect(() => {
    if (!loading && user) {
      router.push('/chat');
    }
  }, [user, loading, router]);

  // Show loading state
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <header className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="mr-2 flex h-10 w-10 items-center justify-center rounded-full bg-blue-600">
              <Lock className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Hushify</h1>
          </div>
          <div className="flex space-x-4">
            <Link 
              href="/login" 
              className="px-4 py-2 font-medium text-blue-600 hover:text-blue-800"
            >
              Login
            </Link>
            <Link 
              href="/register" 
              className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
            >
              Sign Up
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 md:py-24">
        <div className="flex flex-col items-center md:flex-row">
          <div className="mb-10 md:mb-0 md:w-1/2">
            <h2 className="mb-6 text-4xl font-bold text-gray-900 md:text-5xl">
              Secure Messaging for Everyone
            </h2>
            <p className="mb-8 text-xl text-gray-600">
              Hushify provides end-to-end encrypted messaging to keep your conversations private and secure.
            </p>
            <div className="flex space-x-4">
              <Link 
                href="/register" 
                className="rounded-lg bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700"
              >
                Get Started
              </Link>
              <Link 
                href="/about" 
                className="rounded-lg border border-gray-300 px-6 py-3 font-medium text-gray-700 hover:bg-gray-50"
              >
                Learn More
              </Link>
            </div>
          </div>
          <div className="md:w-1/2 md:pl-10">
            <div className="rounded-lg bg-white p-4 shadow-lg">
              {/* Placeholder for a chat UI mockup */}
              <div className="flex items-center rounded-t-lg bg-gray-100 p-3">
                <div className="mr-3 h-8 w-8 rounded-full bg-blue-500"></div>
                <div>
                  <div className="font-medium">Secure Chat</div>
                  <div className="text-xs text-gray-500">Online</div>
                </div>
              </div>
              <div className="h-64 overflow-y-auto p-4">
                <div className="mb-3 flex justify-start">
                  <div className="max-w-xs rounded-lg bg-gray-200 p-2">
                    <p className="text-sm">Hello! This is a secure message.</p>
                  </div>
                </div>
                <div className="mb-3 flex justify-end">
                  <div className="max-w-xs rounded-lg bg-blue-500 p-2 text-white">
                    <p className="text-sm">Hi there! No one can read our conversation.</p>
                  </div>
                </div>
                <div className="flex justify-start">
                  <div className="max-w-xs rounded-lg bg-gray-200 p-2">
                    <p className="text-sm">That is the power of end-to-end encryption!</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-gray-50 py-16">
        <div className="container mx-auto px-4">
          <h2 className="mb-12 text-center text-3xl font-bold">Why Choose Hushify?</h2>
          <div className="grid gap-8 md:grid-cols-3">
            {/* Feature 1 */}
            <div className="rounded-lg bg-white p-6 shadow-md">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                <Lock className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="mb-2 text-xl font-medium">End-to-End Encryption</h3>
              <p className="text-gray-600">
                All messages are encrypted on your device and can only be decrypted by the intended recipient.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="rounded-lg bg-white p-6 shadow-md">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                <MessageCircle className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="mb-2 text-xl font-medium">Real-Time Messaging</h3>
              <p className="text-gray-600">
                Instant message delivery with typing indicators and read receipts.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="rounded-lg bg-white p-6 shadow-md">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                <Shield className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="mb-2 text-xl font-medium">Privacy First</h3>
              <p className="text-gray-600">
                We do not have access to your messages, and we do not collect unnecessary data.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-800 py-8 text-white">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center justify-between md:flex-row">
            <div className="mb-4 md:mb-0">
              <div className="flex items-center">
                <div className="mr-2 flex h-8 w-8 items-center justify-center rounded-full bg-blue-600">
                  <Lock className="h-4 w-4 text-white" />
                </div>
                <h2 className="text-xl font-bold">Hushify</h2>
              </div>
            </div>
            <div className="text-center md:text-right">
              <p>&copy; {new Date().getFullYear()} Hushify. All rights reserved.</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;