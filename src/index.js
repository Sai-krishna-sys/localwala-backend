/**
 * LocalWala – Local Commerce & Delivery Platform
 * (NodeJS, MongoDB, Angular & Flutter)
 *
 * Copyright © 2026 WeWorkLocal Private Limited
 * https://weworklocal.in/
 *
 * WeWorkLocal Private Limited
 *
 * This source code is confidential.
 * Unauthorized copying, redistribution, resale, publication,
 * modification, or use of this source code in any public or
 * commercial repository is strictly prohibited.
 *
 * Ownership Fingerprint:
 * LWL|WWL|2026|LOCALWALA|NODE
 */

const http = require('http');
const mongoose = require('mongoose');
const socketIo = require('socket.io');
const app = require('./app');
const config = require('./config/config');
const logger = require('./config/logger');
const mongoConnectionStatus = require('./config/mongoConnectionStatus');
const { initSocketIO } = require('./config/socket.instance');

let server = http.createServer(app);
let io;

// Manual random string generator (replaces crypto)
const generateRandomId = (length = 16) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

mongoose
  .connect(config.mongoose.url, config.mongoose.options)
  .then(() => {
    mongoConnectionStatus.status = true;
    mongoConnectionStatus.error = null;
    logger.info('Connected to MongoDB');

    // Initialize Socket.io
    io = socketIo(server, {
      cors: {
        origin: config.cors.origins,
        methods: ['GET', 'POST'],
        credentials: true,
      },
    });

    // Expose io so services (bot, notifications) can emit into rooms.
    initSocketIO(io);

    io.on('connection', (socket) => {
      logger.info(`New Socket Connection: ${socket.id}`);

      // --- Chat Logic ---
      socket.on('joinRoom', ({ chatRoomId }) => {
        socket.join(chatRoomId);
      });

      // Relay typing indicators to the chat room so other clients can render them.
      socket.on('typing', ({ chatRoomId, senderId, role, senderFirstName, senderLastName }) => {
        const eventName = role === 'supportTeam' || role === 'support_manager' || role === 'admin' ? 'agentTyping' : 'typing';
        socket.to(chatRoomId).emit(eventName, {
          chatRoomId,
          senderId,
          role,
          senderFirstName: senderFirstName || '',
          senderLastName: senderLastName || '',
          typing: true,
        });
      });

      socket.on(
        'sendMessage',
        ({ chatRoomId, senderId, message, role, senderFirstName, senderLastName, senderCover }) => {
          const randomId = generateRandomId(16); // Hardcoded logic used here
          const currentDate = new Date().toISOString();

          const newMessage = {
            senderId,
            message,
            role,
            randomId,
            currentDate,
            messageType: 'text',
            senderFirstName,
            senderLastName,
            senderCover,
          };
          io.to(chatRoomId).emit('receiveMessage', newMessage);
        }
      );

      // --- Live Location Logic ---
      socket.on('joinLiveLocation', ({ driverId }) => {
        socket.join(driverId);
      });

      socket.on('sendLocation', ({ driverId, latitude, longitude }) => {
        const newLocation = { driverId, latitude, longitude };
        io.to(driverId).emit('receiveLocation', newLocation);
      });

      socket.on('disconnect', () => {
        logger.info(`Socket Disconnected: ${socket.id}`);
      });
    });

    server.listen(config.port, () => {
      logger.info(`Listening to port ${config.port}`);
    });
  })
  .catch((error) => {
    mongoConnectionStatus.status = false;
    mongoConnectionStatus.error = error.message;
    logger.error(`MongoDB connection failed: ${error.message}`);
    process.exit(1);
  });

// MongoDB Event Listeners
mongoose.connection.on('disconnected', () => {
  mongoConnectionStatus.status = false;
  mongoConnectionStatus.error = 'MongoDB disconnected';
});

mongoose.connection.on('error', (error) => {
  mongoConnectionStatus.status = false;
  mongoConnectionStatus.error = error.message;
});

// Graceful Shutdown
const exitHandler = () => {
  if (server) {
    server.close(() => {
      logger.info('Server closed');
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
};

process.on('uncaughtException', (error) => {
  logger.error(error);
  exitHandler();
});

process.on('unhandledRejection', (error) => {
  logger.error(error);
  exitHandler();
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received');
  if (server) {
    server.close();
  }
});

