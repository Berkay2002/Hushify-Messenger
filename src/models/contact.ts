import mongoose, { Document, Schema } from 'mongoose';

export interface IContact extends Document {
  owner: mongoose.Types.ObjectId;
  contact: mongoose.Types.ObjectId;
  nickname?: string;
  conversationId: string;
  lastMessage?: string;
  lastMessageTimestamp?: Date;
  unreadCount: number;
  isBlocked: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ContactSchema = new Schema<IContact>(
  {
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    contact: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    nickname: {
      type: String,
      trim: true,
    },
    conversationId: {
      type: String,
      required: true,
    },
    lastMessage: {
      type: String,
    },
    lastMessageTimestamp: {
      type: Date,
    },
    unreadCount: {
      type: Number,
      default: 0,
    },
    isBlocked: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Create composite index for owner and contact
ContactSchema.index({ owner: 1, contact: 1 }, { unique: true });

// Generate conversationId from owner and contact IDs
ContactSchema.pre('save', function (next) {
  if (!this.conversationId) {
    // Sort IDs to ensure consistent conversation ID
    const ids = [this.owner.toString(), this.contact.toString()].sort();
    this.conversationId = ids.join('_');
  }
  next();
});

export default mongoose.models.Contact || mongoose.model<IContact>('Contact', ContactSchema);