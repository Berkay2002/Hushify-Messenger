// src/app/api/keys/[userId]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '../../../../lib/db';
import User from '../../../../models/user';
import { authMiddleware } from '../../../../lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    // Authenticate user
    const user = await authMiddleware();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const { userId } = params;
    
    // Connect to database
    await connectToDatabase();
    
    // Get target user
    const targetUser = await User.findById(userId);
    
    if (!targetUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    // Check if public key exists
    if (!targetUser.publicKey) {
      return NextResponse.json(
        { error: 'User has not registered a public key' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      publicKey: targetUser.publicKey,
    });
  } catch (error) {
    console.error('Get user public key error:', error);
    
    return NextResponse.json(
      { error: 'Failed to get user public key' },
      { status: 500 }
    );
  }
}