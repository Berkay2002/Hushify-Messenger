import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import mongoose from 'mongoose';
import connectToDatabase from '../../../lib/db';
import Contact from '../../../models/contact';
import User from '../../../models/user';
import { authMiddleware } from '../../../lib/auth';
import redis from '../../../lib/redis';

// Input validation schema for adding contacts
const addContactSchema = z.object({
  email: z.string().email('Invalid email address'),
  nickname: z.string().optional(),
});

// Get all contacts
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
    
    // Fetch user's contacts
    const contacts = await Contact.find({ owner: user.userId })
      .populate('contact', 'name email avatar status')
      .sort({ lastMessageTimestamp: -1 })
      .lean();
    
    // Get online status for all contacts from Redis
    const onlineStatus = await Promise.all(
      contacts.map(async (contact) => {
        const isOnline = await redis.get(`user:${contact.contact._id}:online`);
        const lastSeen = await redis.get(`user:${contact.contact._id}:last_seen`);
        
        return {
          userId: contact.contact._id,
          isOnline: isOnline === 'true',
          lastSeen: lastSeen ? new Date(lastSeen) : null,
        };
      })
    );
    
    // Map online status to contacts
    const contactsWithStatus = contacts.map(contact => {
      const status = onlineStatus.find(s => s.userId.toString() === contact.contact._id.toString());
      
      return {
        id: contact._id,
        contactId: contact.contact._id,
        name: contact.contact.name,
        email: contact.contact.email,
        avatar: contact.contact.avatar,
        status: contact.contact.status,
        nickname: contact.nickname,
        conversationId: contact.conversationId,
        lastMessage: contact.lastMessage,
        lastMessageTimestamp: contact.lastMessageTimestamp,
        unreadCount: contact.unreadCount,
        isBlocked: contact.isBlocked,
        isOnline: status?.isOnline || false,
        lastSeen: status?.lastSeen || contact.contact.lastSeen,
      };
    });
    
    return NextResponse.json({
      success: true,
      contacts: contactsWithStatus,
    });
  } catch (error) {
    console.error('Get contacts error:', error);
    
    return NextResponse.json(
      { error: 'Failed to get contacts' },
      { status: 500 }
    );
  }
}

// Add a new contact
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
    const validationResult = addContactSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.errors },
        { status: 400 }
      );
    }
    
    const { email, nickname } = validationResult.data;
    
    // Connect to database
    await connectToDatabase();
    
    // Check if contact exists
    const contactUser = await User.findOne({ email });
    
    if (!contactUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    // Check if trying to add self
    if (contactUser._id.toString() === user.userId) {
      return NextResponse.json(
        { error: 'Cannot add yourself as a contact' },
        { status: 400 }
      );
    }
    
    // Check if contact already exists
    const existingContact = await Contact.findOne({
      owner: user.userId,
      contact: contactUser._id,
    });
    
    if (existingContact) {
      return NextResponse.json(
        { error: 'Contact already exists' },
        { status: 409 }
      );
    }
    
    // Generate conversation ID
    const ids = [user.userId, contactUser._id.toString()].sort();
    const conversationId = ids.join('_');
    
    // Create contact
    const newContact = new Contact({
      owner: new mongoose.Types.ObjectId(user.userId),
      contact: contactUser._id,
      nickname,
      conversationId,
    });
    
    await newContact.save();
    
    // Get online status
    const isOnline = await redis.get(`user:${contactUser._id}:online`);
    const lastSeen = await redis.get(`user:${contactUser._id}:last_seen`);
    
    return NextResponse.json({
      success: true,
      contact: {
        id: newContact._id,
        contactId: contactUser._id,
        name: contactUser.name,
        email: contactUser.email,
        avatar: contactUser.avatar,
        status: contactUser.status,
        nickname: newContact.nickname,
        conversationId: newContact.conversationId,
        unreadCount: 0,
        isBlocked: false,
        isOnline: isOnline === 'true',
        lastSeen: lastSeen ? new Date(lastSeen) : contactUser.lastSeen,
      },
    });
  } catch (error) {
    console.error('Add contact error:', error);
    
    return NextResponse.json(
      { error: 'Failed to add contact' },
      { status: 500 }
    );
  }
}