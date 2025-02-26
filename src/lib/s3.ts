import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

const bucketName = process.env.S3_BUCKET_NAME || '';

if (!bucketName) {
  throw new Error('S3_BUCKET_NAME environment variable is not defined');
}

// Generate a unique key for the file
export function generateFileKey(userId: string, filename: string): string {
  const uuid = uuidv4();
  const timestamp = Date.now();
  const extension = filename.split('.').pop();
  
  return `${userId}/${timestamp}-${uuid}.${extension}`;
}

// Create a presigned URL for direct file upload from the client
export async function createPresignedUploadUrl(
  userId: string,
  filename: string,
  contentType: string,
  maxSize: number = 10 * 1024 * 1024 // 10MB default
): Promise<{ url: string; fields: Record<string, string> }> {
  const key = generateFileKey(userId, filename);
  
  const { url, fields } = await createPresignedPost(s3Client, {
    Bucket: bucketName,
    Key: key,
    Conditions: [
      ['content-length-range', 0, maxSize],
      ['eq', '$Content-Type', contentType],
    ],
    Fields: {
      'Content-Type': contentType,
    },
    Expires: 300, // 5 minutes
  });
  
  return { 
    url, 
    fields: {
      ...fields,
      key // Include the key in the response
    }
  };
}

// Generate a presigned URL for reading a file
export async function getPresignedReadUrl(key: string, expiresIn: number = 3600): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });
  
  return await getSignedUrl(s3Client, command, { expiresIn });
}

// Upload a file from the server (for server-side processing)
export async function uploadFile(
  key: string,
  body: Buffer | Uint8Array | Blob,
  contentType: string
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: body,
    ContentType: contentType,
  });
  
  await s3Client.send(command);
  
  // Return the S3 object URL
  return `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
}

// Delete a file
export async function deleteFile(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: key,
  });
  
  await s3Client.send(command);
}

// Check if a file exists
export async function fileExists(key: string): Promise<boolean> {
  try {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });
    
    await s3Client.send(command);
    return true;
  } catch {
    return false;
  }
}