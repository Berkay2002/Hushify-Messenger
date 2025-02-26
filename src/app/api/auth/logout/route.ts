import { NextResponse } from 'next/server';
import { clearAuthCookies, getUserFromRequest } from '../../../../lib/auth';
import connectToDatabase from '../../../../lib/db';
import User from '../../../../models/user';
import redis from '../../../../lib/redis';

export async function POST() {
  try {
    // Get user from request
    const user = await getUserFromRequest();
    
    if (user) {
      // Connect to database
      await connectToDatabase();
      
      // Update user's online status
      await User.findByIdAndUpdate(user.userId, {
        isOnline: false,
        lastSeen: new Date(),
      });
      
      // Update Redis status
      await redis.set(`user:${user.userId}:online`, 'false');
      await redis.set(`user:${user.userId}:last_seen`, new Date().toISOString());
    }
    
    // Clear auth cookies
    const response = NextResponse.json({ success: true });
    clearAuthCookies(response);
    
    return response;
  } catch (error) {
    console.error('Logout error:', error);
    
    // Even if there's an error, try to clear cookies
    const response = NextResponse.json(
      { error: 'Failed to logout' },
      { status: 500 }
    );
    clearAuthCookies(response);
    
    return response;
  }
}