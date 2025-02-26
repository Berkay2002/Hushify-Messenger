import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authMiddleware } from '../../../../lib/auth';
import { createPresignedUploadUrl } from '../../../../lib/s3';

// Input validation schema
const uploadRequestSchema = z.object({
  filename: z.string().min(1, 'Filename is required'),
  contentType: z.string().min(1, 'Content type is required'),
  fileSize: z.number().min(1, 'File size is required'),
});

// Generate presigned URL for client-side upload
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
    const validationResult = uploadRequestSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.errors },
        { status: 400 }
      );
    }
    
    const { filename, contentType, fileSize } = validationResult.data;
    
    // Validate file size (limit to 50MB)
    const maxSize = 50 * 1024 * 1024; // 50MB
    
    if (fileSize > maxSize) {
      return NextResponse.json(
        { error: 'File size exceeds the maximum limit of 50MB' },
        { status: 400 }
      );
    }
    
    // Validate content type
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'audio/mpeg',
      'audio/wav',
      'audio/ogg',
      'video/mp4',
      'video/webm',
      'application/zip',
      'application/x-rar-compressed',
    ];
    
    if (!allowedTypes.includes(contentType)) {
      return NextResponse.json(
        { error: 'File type not allowed' },
        { status: 400 }
      );
    }
    
    // Generate presigned URL
    const { url, fields } = await createPresignedUploadUrl(
      user.userId,
      filename,
      contentType,
      fileSize
    );
    
    return NextResponse.json({
      success: true,
      uploadUrl: url,
      fields,
      fileKey: fields.key,
    });
  } catch (error) {
    console.error('Media upload error:', error);
    
    return NextResponse.json(
      { error: 'Failed to generate upload URL' },
      { status: 500 }
    );
  }
}