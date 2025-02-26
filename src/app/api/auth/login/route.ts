import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import connectToDatabase from '../../../../lib/db';
import User from '../../../../models/user';
import { createAccessToken, createRefreshToken, setTokenCookies } from '../../../../lib/auth';
import redis from '../../../../lib/redis';

// Input validation schema
const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    
    // Validate input
    const validationResult = loginSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.errors },
        { status: 400 }
      );
    }
    
    const { email, password } = validationResult.data;
    
    // Connect to database
    await connectToDatabase();
    
    // Find user and include password field (not included by default)
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }
    
    // Compare password
    const isPasswordValid = await user.comparePassword(password);
    
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }
    
    // Generate tokens
    const accessToken = await createAccessToken({
      userId: user._id.toString(),
      email: user.email,
    });
    
    const refreshToken = await createRefreshToken({
      userId: user._id.toString(),
      email: user.email,
    });
    
    // Update user's online status in Redis
    await redis.set(`user:${user._id}:online`, 'true');
    await redis.expire(`user:${user._id}:online`, 3600); // Expire after 1 hour
    
    // Update user's last seen
    user.lastSeen = new Date();
    user.isOnline = true;
    await user.save();
    
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
    
    // Set cookies
    setTokenCookies(response, accessToken, refreshToken);
    
    return response;
  } catch (error) {
    console.error('Login error:', error);
    
    return NextResponse.json(
      { error: 'Failed to login' },
      { status: 500 }
    );
  }
}