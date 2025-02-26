import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

const accessTokenSecret = process.env.JWT_ACCESS_SECRET;
const refreshTokenSecret = process.env.JWT_REFRESH_SECRET;

if (!accessTokenSecret || !refreshTokenSecret) {
  throw new Error('JWT secrets must be defined');
}

// Define token types
export type TokenPayload = {
  userId: string;
  email: string;
  jti: string;
};

// Create access token
export async function createAccessToken(payload: Omit<TokenPayload, 'jti'>): Promise<string> {
  const jti = uuidv4();
  const accessToken = await new SignJWT({ ...payload, jti })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(process.env.JWT_ACCESS_EXPIRES_IN || '15m')
    .sign(new TextEncoder().encode(accessTokenSecret));
  
  return accessToken;
}

// Create refresh token
export async function createRefreshToken(payload: Omit<TokenPayload, 'jti'>): Promise<string> {
  const jti = uuidv4();
  const refreshToken = await new SignJWT({ ...payload, jti })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(process.env.JWT_REFRESH_EXPIRES_IN || '7d')
    .sign(new TextEncoder().encode(refreshTokenSecret));
  
  return refreshToken;
}

// Verify access token
export async function verifyAccessToken(token: string): Promise<TokenPayload> {
  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(accessTokenSecret)
    );
    return payload as TokenPayload;
  } catch {
    throw new Error('Invalid access token');
  }
}

// Verify refresh token
export async function verifyRefreshToken(token: string): Promise<TokenPayload> {
  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(refreshTokenSecret)
    );
    return payload as TokenPayload;
  } catch {
    throw new Error('Invalid refresh token');
  }
}

// Set tokens in cookies
export function setTokenCookies(
  response: NextResponse,
  accessToken: string,
  refreshToken: string
): NextResponse {
  response.cookies.set({
    name: 'accessToken',
    value: accessToken,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 15 * 60, // 15 minutes in seconds
  });

  response.cookies.set({
    name: 'refreshToken',
    value: refreshToken,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
  });

  return response;
}

// Clear auth cookies
export function clearAuthCookies(response: NextResponse): NextResponse {
  response.cookies.set({
    name: 'accessToken',
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });

  response.cookies.set({
    name: 'refreshToken',
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });

  return response;
}

// Get user from request
export async function getUserFromRequest(): Promise<TokenPayload | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('accessToken')?.value;
  
  if (!accessToken) {
    return null;
  }

  try {
    const payload = await verifyAccessToken(accessToken);
    return payload;
  } catch {
    return null;
  }
}

// Authentication middleware
export async function authMiddleware(): Promise<TokenPayload | null> {
  return await getUserFromRequest();
}