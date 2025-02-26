import mongoose from 'mongoose';

if (!process.env.MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable');
}

const MONGODB_URI = process.env.MONGODB_URI;

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development. This prevents connections growing exponentially
 * during API Route usage.
 */

// Define interfaces for global mongoose cache
interface GlobalWithMongoose {
  mongoose: {
    conn: mongoose.Mongoose | null;
    promise: Promise<mongoose.Mongoose> | null;
  } | undefined;
}

// Use type assertion to work with the global object
const globalWithMongoose = global as unknown as GlobalWithMongoose;

// Initialize the cached connection object
const cached = globalWithMongoose.mongoose ?? {
  conn: null,
  promise: null,
};

// Set back the cached connection to the global object
if (!globalWithMongoose.mongoose) {
  globalWithMongoose.mongoose = cached;
}

async function connectToDatabase(): Promise<mongoose.Mongoose> {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts);
  }
  
  cached.conn = await cached.promise;
  return cached.conn;
}

export default connectToDatabase;