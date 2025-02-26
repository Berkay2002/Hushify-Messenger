import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import connectToDatabase from '../../../../lib/db';
import User from '../../../../models/user';
import { createAccessToken, createRefreshToken, setTokenCookies } from '../../../../lib/auth';

// Input validation schema
const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    
    // Validate input
    const validationResult = registerSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.errors },
        { status: 400 }
      );
    }
    
    const { name, email, password } = validationResult.data;
    
    // Connect to database
    await connectToDatabase();
    
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    
    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      );
    }
    
    // Create new user
    const newUser = new User({
      name,
      email,
      password, // Will be hashed in the User model pre-save hook
    });
    
    await newUser.save();
    
    // Generate tokens
    const accessToken = await createAccessToken({
      userId: newUser._id.toString(),
      email: newUser.email,
    });
    
    const refreshToken = await createRefreshToken({
      userId: newUser._id.toString(),
      email: newUser.email,
    });
    
    // Create response
    const response = NextResponse.json(
      {
        success: true,
        user: {
          id: newUser._id,
          name: newUser.name,
          email: newUser.email,
        },
      },
      { status: 201 }
    );
    
    // Set cookies
    setTokenCookies(response, accessToken, refreshToken);
    
    return response;
  } catch (error) {
    console.error('Registration error:', error);
    
    return NextResponse.json(
      { error: 'Failed to register user' },
      { status: 500 }
    );
  }
}