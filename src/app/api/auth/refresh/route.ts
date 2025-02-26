import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAccessToken, setTokenCookies, verifyRefreshToken } from '../../../../lib/auth';
import User from '../../../../models/user';
import connectToDatabase from '../../../../lib/db';

export async function POST() {
  try {
    // Get refresh token from cookies
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get('refreshToken')?.value;
    
    if (!refreshToken) {
      return NextResponse.json(
        { error: 'Refresh token not found' },
        { status: 401 }
      );
    }
    
    // Verify refresh token
    const payload = await verifyRefreshToken(refreshToken);
    
    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid refresh token' },
        { status: 401 }
      );
    }
    
    // Connect to database
    await connectToDatabase();
    
    // Check if user exists
    const user = await User.findById(payload.userId);
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    // Generate new access token
    const newAccessToken = await createAccessToken({
      userId: user._id.toString(),
      email: user.email,
    });
    
    // Create response
    const response = NextResponse.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        status: user.status,
      },
    });
    
    // Set new access token in cookies (keeping the same refresh token)
    setTokenCookies(response, newAccessToken, refreshToken);
    
    return response;
  } catch (error) {
    console.error('Token refresh error:', error);
    
    return NextResponse.json(
      { error: 'Failed to refresh token' },
      { status: 500 }
    );
  }
}