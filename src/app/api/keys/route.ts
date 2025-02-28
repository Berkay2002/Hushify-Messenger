import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import connectToDatabase from '../../../lib/db';
import User from '../../../models/user';
import { authMiddleware } from '../../../lib/auth';

// Input validation schema
const keySchema = z.object({
  publicKey: z.string().min(1, 'Public key is required'),
});

// Store user's public key
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const user = await authMiddleware();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Parse request body
    const body = await request.json();
    
    // Validate input
    const validationResult = keySchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.errors },
        { status: 400 }
      );
    }
    
    const { publicKey } = validationResult.data;
    
    // Connect to database
    await connectToDatabase();
    
    // Update user with public key
    await User.findByIdAndUpdate(user.userId, {
      publicKey: publicKey,
    });
    
    return NextResponse.json({
      success: true,
      message: 'Public key stored successfully',
    });
  } catch (error) {
    console.error('Store public key error:', error);
    
    return NextResponse.json(
      { error: 'Failed to store public key' },
      { status: 500 }
    );
  }
}

// Get current user's public key
export async function GET() {
  try {
    // Authenticate user
    const user = await authMiddleware();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Connect to database
    await connectToDatabase();
    
    // Get user
    const userData = await User.findById(user.userId);
    
    if (!userData) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    if (!userData.publicKey) {
      return NextResponse.json(
        { error: 'Public key not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      publicKey: userData.publicKey,
    });
  } catch (error) {
    console.error('Get public key error:', error);
    
    return NextResponse.json(
      { error: 'Failed to get public key' },
      { status: 500 }
    );
  }
}