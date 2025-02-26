import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import connectToDatabase from '../../../lib/db';
import User from '../../../models/user';
import { authMiddleware } from '../../../lib/auth';

// Input validation schema for registering keys
const registerKeysSchema = z.object({
  identityKey: z.string().min(1, 'Identity key is required'),
  signedPreKey: z.object({
    keyId: z.number(),
    publicKey: z.string().min(1, 'Public key is required'),
    signature: z.string().min(1, 'Signature is required'),
  }),
  oneTimePreKeys: z.array(
    z.object({
      keyId: z.number(),
      publicKey: z.string().min(1, 'Public key is required'),
    })
  ).min(1, 'At least one one-time pre key is required'),
});

// Register encryption keys
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
    const validationResult = registerKeysSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.errors },
        { status: 400 }
      );
    }
    
    const { identityKey, signedPreKey, oneTimePreKeys } = validationResult.data;
    
    // Connect to database
    await connectToDatabase();
    
    // Update user with keys
    await User.findByIdAndUpdate(user.userId, {
      identityKey,
      signedPreKey,
      oneTimePreKeys,
    });
    
    return NextResponse.json({
      success: true,
      message: 'Keys registered successfully',
    });
  } catch (error) {
    console.error('Register keys error:', error);
    
    return NextResponse.json(
      { error: 'Failed to register keys' },
      { status: 500 }
    );
  }
}

// Get current user's keys
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
    
    // Get user with keys
    const userData = await User.findById(user.userId)
      .select('+identityKey')
      .lean();
    
    if (!userData || Array.isArray(userData)) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      keys: {
        identityKey: userData.identityKey,
        signedPreKey: userData.signedPreKey,
        oneTimePreKeys: userData.oneTimePreKeys,
      },
    });
  } catch (error) {
    console.error('Get keys error:', error);
    
    return NextResponse.json(
      { error: 'Failed to get keys' },
      { status: 500 }
    );
  }
}