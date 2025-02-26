import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import mongoose from 'mongoose';
import connectToDatabase from '../../../lib/db';
import Message from '../../../models/message';
import Contact from '../../../models/contact';
import User from '../../../models/user';
import { authMiddleware } from '../../../lib/auth';

// Input validation schema for sending messages
const sendMessageSchema = z.object({
  recipientId: z.string().min(1, 'Recipient ID is required'),
  content: z.string().min(1, 'Message content is required'),
  contentType: z.enum(['text', 'image', 'file', 'audio']).default('text'),
  mediaUrl: z.string().optional(),
  mediaType: z.string().optional(),
  mediaName: z.string().optional(),
  mediaSize: z.number().optional(),
  expiresIn: z.number().optional(), // Time in seconds until message expires
});

// Query validation schema for getting messages
const getMessagesSchema = z.object({
  conversationId: z.string().optional(),
  contactId: z.string().optional(),
  limit: z.string().transform(Number).default('50'),
  before: z.string().optional(), // Message ID to fetch messages before this one
});

// Send a new message
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
    const validationResult = sendMessageSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.errors },
        { status: 400 }
      );
    }
    
    const {
      recipientId,
      content,
      contentType,
      mediaUrl,
      mediaType,
      mediaName,
      mediaSize,
      expiresIn,
    } = validationResult.data;
    
    // Connect to database
    await connectToDatabase();
    
    // Check if recipient exists
    const recipient = await User.findById(recipientId);
    
    if (!recipient) {
      return NextResponse.json(
        { error: 'Recipient not found' },
        { status: 404 }
      );
    }
    
    // Generate conversation ID (sorted to ensure consistency)
    const ids = [user.userId, recipientId].sort();
    const conversationId = ids.join('_');
    
    // Create message
    const newMessage = new Message({
      sender: new mongoose.Types.ObjectId(user.userId),
      recipient: new mongoose.Types.ObjectId(recipientId),
      conversationId,
      content,
      contentType,
      mediaUrl,
      mediaType,
      mediaName,
      mediaSize,
      expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : undefined,
    });
    
    await newMessage.save();
    
    // Update or create contact entries for both users
    // For sender
    await Contact.findOneAndUpdate(
      {
        owner: new mongoose.Types.ObjectId(user.userId),
        contact: new mongoose.Types.ObjectId(recipientId),
      },
      {
        $set: {
          conversationId,
          lastMessage: content,
          lastMessageTimestamp: new Date(),
        },
        $setOnInsert: {
          owner: new mongoose.Types.ObjectId(user.userId),
          contact: new mongoose.Types.ObjectId(recipientId),
        },
      },
      { upsert: true, new: true }
    );
    
    // For recipient
    await Contact.findOneAndUpdate(
      {
        owner: new mongoose.Types.ObjectId(recipientId),
        contact: new mongoose.Types.ObjectId(user.userId),
      },
      {
        $set: {
          conversationId,
          lastMessage: content,
          lastMessageTimestamp: new Date(),
        },
        $inc: { unreadCount: 1 },
        $setOnInsert: {
          owner: new mongoose.Types.ObjectId(recipientId),
          contact: new mongoose.Types.ObjectId(user.userId),
        },
      },
      { upsert: true, new: true }
    );
    
    return NextResponse.json({
      success: true,
      message: {
        id: newMessage._id,
        sender: user.userId,
        recipient: recipientId,
        conversationId,
        content,
        contentType,
        mediaUrl,
        createdAt: newMessage.createdAt,
      },
    });
  } catch (error) {
    console.error('Send message error:', error);
    
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    );
  }
}

// Get messages for a conversation
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const user = await authMiddleware();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const params = {
      conversationId: searchParams.get('conversationId') || undefined,
      contactId: searchParams.get('contactId') || undefined,
      limit: searchParams.get('limit') || '50',
      before: searchParams.get('before') || undefined,
    };
    
    // Validate query parameters
    const validationResult = getMessagesSchema.safeParse(params);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.errors },
        { status: 400 }
      );
    }
    
    const { conversationId, contactId, limit, before } = validationResult.data;
    
    // Connect to database
    await connectToDatabase();
    
    const query: Record<string, string | { $lt: Date }> = {};
    
    if (conversationId) {
      // If conversationId is provided, use it directly
      query.conversationId = conversationId;
    } else if (contactId) {
      // If contactId is provided, generate conversationId
      const ids = [user.userId, contactId].sort();
      query.conversationId = ids.join('_');
    } else {
      return NextResponse.json(
        { error: 'Either conversationId or contactId must be provided' },
        { status: 400 }
      );
    }
    
    // Add 'before' filter if provided
    if (before) {
      const beforeMessage = await Message.findById(before);
      if (beforeMessage) {
        query.createdAt = { $lt: beforeMessage.createdAt };
      }
    }
    
    // Fetch messages
    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('sender', 'name avatar')
      .lean();
    
    // Mark messages as read if they were sent to the current user
    await Message.updateMany(
      {
        _id: { $in: messages.map(m => m._id) },
        recipient: user.userId,
        isRead: false,
      },
      {
        $set: {
          isRead: true,
          readAt: new Date(),
        },
      }
    );
    
    // Reset unread count in contact
    if (conversationId || contactId) {
      await Contact.findOneAndUpdate(
        {
          owner: user.userId,
          conversationId: query.conversationId,
        },
        {
          $set: { unreadCount: 0 },
        }
      );
    }
    
    return NextResponse.json({
      success: true,
      messages: messages.map(m => ({
        id: m._id,
        sender: m.sender._id,
        senderName: m.sender.name,
        senderAvatar: m.sender.avatar,
        recipient: m.recipient,
        conversationId: m.conversationId,
        content: m.content,
        contentType: m.contentType,
        mediaUrl: m.mediaUrl,
        mediaType: m.mediaType,
        mediaName: m.mediaName,
        mediaSize: m.mediaSize,
        isRead: m.isRead,
        createdAt: m.createdAt,
        expiresAt: m.expiresAt,
      })),
    });
  } catch (error) {
    console.error('Get messages error:', error);
    
    return NextResponse.json(
      { error: 'Failed to get messages' },
      { status: 500 }
    );
  }
}