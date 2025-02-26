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
    const targetUser = await User.findById(userId)
      .select('+identityKey')
      .lean();
    
    if (!targetUser || Array.isArray(targetUser)) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    // Check if keys exist
    if (!targetUser.identityKey || !targetUser.signedPreKey) {
      return NextResponse.json(
        { error: 'User has not registered encryption keys' },
        { status: 400 }
      );
    }
    
    // Get a one-time pre-key (if available)
    let oneTimePreKey = null;
    
    if (targetUser.oneTimePreKeys && targetUser.oneTimePreKeys.length > 0) {
      // Get a random one-time pre-key
      const randomIndex = Math.floor(Math.random() * targetUser.oneTimePreKeys.length);
      oneTimePreKey = targetUser.oneTimePreKeys[randomIndex];
      
      // Remove the used one-time pre-key
      await User.findByIdAndUpdate(userId, {
        $pull: { oneTimePreKeys: { keyId: oneTimePreKey.keyId } },
      });
    }
    
    return NextResponse.json({
      success: true,
      preKeyBundle: {
        identityKey: targetUser.identityKey,
        signedPreKey: targetUser.signedPreKey,
        oneTimePreKey,
        registrationId: targetUser._id, // Use user ID as registration ID
      },
    });
  } catch (error) {
    console.error('Get pre-key bundle error:', error);
    
    return NextResponse.json(
      { error: 'Failed to get pre-key bundle' },
      { status: 500 }
    );
  }
}