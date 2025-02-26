import mongoose, { Document, Schema } from 'mongoose';

export interface IMessage extends Document {
  sender: mongoose.Types.ObjectId;
  recipient: mongoose.Types.ObjectId;
  conversationId: string;
  content: string; // Encrypted message content
  contentType: 'text' | 'image' | 'file' | 'audio';
  mediaUrl?: string;
  mediaType?: string;
  mediaName?: string;
  mediaSize?: number;
  isRead: boolean;
  readAt?: Date;
  deliveredAt?: Date;
  expiresAt?: Date; // For message expiration
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    sender: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    recipient: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    conversationId: {
      type: String,
      required: true,
      index: true,
    },
    content: {
      type: String,
      required: true,
    },
    contentType: {
      type: String,
      enum: ['text', 'image', 'file', 'audio'],
      default: 'text',
    },
    mediaUrl: {
      type: String,
    },
    mediaType: {
      type: String,
    },
    mediaName: {
      type: String,
    },
    mediaSize: {
      type: Number,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    readAt: {
      type: Date,
    },
    deliveredAt: {
      type: Date,
    },
    expiresAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

// Create indices for faster queries
MessageSchema.index({ sender: 1, recipient: 1 });
MessageSchema.index({ conversationId: 1, createdAt: -1 });

// Generate conversationId from sender and recipient IDs
MessageSchema.pre('save', function (next) {
  if (!this.conversationId) {
    // Sort IDs to ensure consistent conversation ID regardless of who sends the message
    const ids = [this.sender.toString(), this.recipient.toString()].sort();
    this.conversationId = ids.join('_');
  }
  next();
});

export default mongoose.models.Message || mongoose.model<IMessage>('Message', MessageSchema);