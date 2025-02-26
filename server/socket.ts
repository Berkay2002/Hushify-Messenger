import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { verifyAccessToken } from '../src/lib/auth';
import redis from '../src/lib/redis';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface SocketUser {
  userId: string;
  socketId: string;
}

export const initSocketServer = (httpServer: HttpServer) => {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.NODE_ENV === 'production' 
        ? ['https://yourdomain.com']
        : ['http://localhost:3000'],
      credentials: true,
    },
  });

  // Connected users mapping
  const connectedUsers = new Map<string, string[]>(); // userId -> socketIds[]

  // Middleware for authentication
  io.use(async (socket: Socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication token missing'));
      }
      
      const payload = await verifyAccessToken(token);
      
      if (!payload) {
        return next(new Error('Invalid authentication token'));
      }
      
      // Attach user data to socket
      socket.data.user = { userId: payload.userId, email: payload.email };
      next();
    } catch {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const { userId } = socket.data.user;
    
    console.log(`User connected: ${userId}, Socket ID: ${socket.id}`);
    
    // Add user to connected users map
    if (connectedUsers.has(userId)) {
      connectedUsers.get(userId)?.push(socket.id);
    } else {
      connectedUsers.set(userId, [socket.id]);
    }
    
    // Update user online status in Redis
    redis.set(`user:${userId}:online`, 'true');
    redis.expire(`user:${userId}:online`, 3600); // Expire after 1 hour
    
    // Notify contacts that user is online
    socket.broadcast.emit('user:online', { userId });

    // Handle private messages
    socket.on('message:send', async (data: { recipientId: string; message: string; conversationId: string }) => {
      const { recipientId, message, conversationId } = data;
      
      // Get recipient socket IDs
      const recipientSocketIds = connectedUsers.get(recipientId) || [];
      
      // Emit message to all recipient sockets
      recipientSocketIds.forEach(socketId => {
        io.to(socketId).emit('message:receive', {
          senderId: userId,
          message,
          conversationId,
          timestamp: new Date(),
        });
      });
      
      // Store delivery status in Redis for offline recipients
      if (recipientSocketIds.length === 0) {
        const pendingMessages = JSON.stringify([{
          senderId: userId,
          message,
          conversationId,
          timestamp: new Date(),
        }]);
        
        await redis.lpush(`user:${recipientId}:pending_messages`, pendingMessages);
        await redis.expire(`user:${recipientId}:pending_messages`, 604800); // 7 days
      }
    });

    // Handle typing indicators
    socket.on('typing:start', (data: { recipientId: string; conversationId: string }) => {
      const { recipientId, conversationId } = data;
      
      const recipientSocketIds = connectedUsers.get(recipientId) || [];
      
      recipientSocketIds.forEach(socketId => {
        io.to(socketId).emit('typing:start', {
          senderId: userId,
          conversationId,
        });
      });
    });

    socket.on('typing:stop', (data: { recipientId: string; conversationId: string }) => {
      const { recipientId, conversationId } = data;
      
      const recipientSocketIds = connectedUsers.get(recipientId) || [];
      
      recipientSocketIds.forEach(socketId => {
        io.to(socketId).emit('typing:stop', {
          senderId: userId,
          conversationId,
        });
      });
    });

    // Handle message status updates
    socket.on('message:delivered', (data: { messageId: string; senderId: string }) => {
      const { messageId, senderId } = data;
      
      const senderSocketIds = connectedUsers.get(senderId) || [];
      
      senderSocketIds.forEach(socketId => {
        io.to(socketId).emit('message:status', {
          messageId,
          status: 'delivered',
          timestamp: new Date(),
        });
      });
    });

    socket.on('message:read', (data: { messageId: string; senderId: string }) => {
      const { messageId, senderId } = data;
      
      const senderSocketIds = connectedUsers.get(senderId) || [];
      
      senderSocketIds.forEach(socketId => {
        io.to(socketId).emit('message:status', {
          messageId,
          status: 'read',
          timestamp: new Date(),
        });
      });
    });

    // Fetch pending messages on connection
    (async () => {
      // Check if user has pending messages
      const pendingMessages = await redis.lrange(`user:${userId}:pending_messages`, 0, -1);
      
      if (pendingMessages && pendingMessages.length > 0) {
        // Parse and send pending messages
        pendingMessages.forEach(messageStr => {
          try {
            const messageData = JSON.parse(messageStr);
            socket.emit('message:receive', messageData);
          } catch (error) {
            console.error('Error parsing pending message:', error);
          }
        });
        
        // Clear pending messages
        await redis.del(`user:${userId}:pending_messages`);
      }
    })();

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${userId}, Socket ID: ${socket.id}`);
      
      // Remove socket ID from connected users map
      const userSocketIds = connectedUsers.get(userId) || [];
      const updatedSocketIds = userSocketIds.filter(id => id !== socket.id);
      
      if (updatedSocketIds.length > 0) {
        connectedUsers.set(userId, updatedSocketIds);
      } else {
        connectedUsers.delete(userId);
        
        // Update user online status
        redis.set(`user:${userId}:online`, 'false');
        redis.set(`user:${userId}:last_seen`, new Date().toISOString());
        
        // Notify contacts that user is offline
        socket.broadcast.emit('user:offline', { userId });
      }
    });
  });

  return io;
};

export default initSocketServer;