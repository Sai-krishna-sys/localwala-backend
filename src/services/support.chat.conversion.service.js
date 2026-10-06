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

const mongoose = require('mongoose');
const { SupportChatConversion, SupportChatRoom, User } = require('../models');
const supportBotService = require('./support.bot.service');

const SUPPORT_ROLE = 'supportTeam';

const getMessages = async (roomID, options) => {
  const limit = options.limit && parseInt(options.limit, 10) > 0 ? parseInt(options.limit, 10) : 10;
  const page = options.page && parseInt(options.page, 10) > 0 ? parseInt(options.page, 10) : 1;
  const skip = (page - 1) * limit;
  const conversionQuery = [
    { $match: { roomId: new mongoose.Types.ObjectId(roomID) } },
    { $sort: { createdAt: -1 } },
    { $skip: skip },
    { $limit: Number(limit) },
    {
      $lookup: {
        from: 'users',
        localField: 'senderId',
        foreignField: '_id',
        as: 'users',
      },
    },
    {
      $unwind: {
        path: '$users',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $project: {
        _id: 0,
        id: '$_id',
        roomId: 1,
        senderId: 1,
        message: 1,
        messageType: 1,
        metadata: 1,
        createdAt: 1,
        sender: {
          id: { $ifNull: ['$users._id', ''] },
          image: { $ifNull: ['$users.image', ''] },
          firstName: { $ifNull: ['$users.firstName', ''] },
          lastName: { $ifNull: ['$users.lastName', ''] },
          role: { $ifNull: ['$users.role', ''] },
        },
      },
    },
  ];
  const chats = await SupportChatConversion.aggregate(conversionQuery);
  const totalResults = await SupportChatConversion.countDocuments({
    roomId: new mongoose.Types.ObjectId(roomID),
  });
  return Promise.all([chats, totalResults]).then(() => {
    const totalPages = Math.ceil(totalResults / limit);
    const result = {
      roomID,
      chats,
      page,
      limit,
      totalPages,
      totalResults,
      success: true,
    };
    return Promise.resolve(result);
  });
};

const saveNewMessage = async (room, sender, msg, msgType) => {
  const msgData = new SupportChatConversion({
    roomId: room,
    senderId: sender,
    message: msg,
    messageType: msgType,
  });
  await SupportChatConversion.create(msgData);

  const senderUser = await User.findById(sender, { role: 1 }).lean();
  const isSupportAgent = senderUser && senderUser.role === SUPPORT_ROLE;

  let chatRoomData = await SupportChatRoom.findById(room);
  if (chatRoomData && chatRoomData !== null) {
    const updateBody = {
      lastMessage: msg,
      lastMessageType: msgType,
      status: 'in_progress',
    };

    // Reopen rule (A4): a customer re-messaging a resolved chat reopens the SAME room.
    if (!isSupportAgent && chatRoomData.status === 'resolved') {
      updateBody.resolvedBy = null;
      updateBody.status = 'open';
    }

    Object.assign(chatRoomData, updateBody);
    await chatRoomData.save();
  }

  // A1 fix: only support agents are added to the agent roster (supportTeam[]).
  // Customers no longer pollute supportTeam. A chat is owned via assignedTo.
  if (isSupportAgent) {
    const agentUpdate = { $addToSet: { supportTeam: sender } };
    if (chatRoomData && !chatRoomData.assignedTo) {
      agentUpdate.$set = { assignedTo: sender, assignedAt: new Date() };
    }
    await SupportChatRoom.findByIdAndUpdate(room, agentUpdate, { new: true });
  }

  // C1: bot auto-reply — only for CUSTOMER messages, and only while no human
  // agent owns the chat yet. The bot writes into the SAME thread via its own
  // writeBotReply (direct create), so this never recurses back here.
  if (!isSupportAgent && chatRoomData) {
    const activeRoom = chatRoomData.assignedTo ? chatRoomData : await SupportChatRoom.findById(room);
    if (!activeRoom.assignedTo) {
      try {
        await supportBotService.handleMessage({
          roomId: room,
          userId: sender,
          message: msg,
          supportType: activeRoom.supportType || 'orders',
        });
      } catch (botError) {
        // Bot failure must never break the customer's ability to chat.
        // eslint-disable-next-line no-console
        console.error('support.bot.handleMessage error:', botError);
      }
    }
  }

  return { success: true };
};

const saveSupportMessage = async (room, sender, msg, msgType) => {
  const msgData = new SupportChatConversion({
    roomId: room,
    senderId: sender,
    message: msg,
    messageType: msgType,
  });
  await SupportChatConversion.create(msgData);

  const senderUser = await User.findById(sender, { role: 1 }).lean();
  const isSupportAgent = senderUser && senderUser.role === SUPPORT_ROLE;

  const chatRoomData = await SupportChatRoom.findById(room);
  if (chatRoomData && chatRoomData !== null) {
    const updateBody = {
      lastMessage: msg,
      lastMessageType: msgType,
      status: 'in_progress',
    };

    // Reopen rule (A4): a customer re-messaging a resolved chat reopens the SAME room.
    if (!isSupportAgent && chatRoomData.status === 'resolved') {
      updateBody.resolvedBy = null;
      updateBody.status = 'open';
    }

    // First Response Time tracking: record when first human agent message is sent
    if (isSupportAgent && !chatRoomData.firstHumanReplyAt) {
      updateBody.firstHumanReplyAt = new Date();
    }

    // Agent Response Time tracking: record when assigned agent first replies
    if (isSupportAgent && !chatRoomData.firstAgentReplyAt && chatRoomData.assignedTo && String(chatRoomData.assignedTo) === String(sender)) {
      updateBody.firstAgentReplyAt = new Date();
    }

    Object.assign(chatRoomData, updateBody);
    await chatRoomData.save();
  }

  // A1 fix: only support agents are added to the agent roster (supportTeam[]).
  // Customers no longer pollute supportTeam. A chat is owned via assignedTo.
  if (isSupportAgent) {
    const agentUpdate = { $addToSet: { supportTeam: sender } };
    if (chatRoomData && !chatRoomData.assignedTo) {
      agentUpdate.$set = { assignedTo: sender, assignedAt: new Date() };
    }
    await SupportChatRoom.findByIdAndUpdate(room, agentUpdate, { new: true });
  }

  // C1: bot auto-reply — only for CUSTOMER messages, and only while no human
  // agent owns the chat yet. The bot writes into the SAME thread via its own
  // writeBotReply (direct create), so this never recurses back here.
  if (!isSupportAgent && chatRoomData) {
    const activeRoom = chatRoomData.assignedTo ? chatRoomData : await SupportChatRoom.findById(room);
    if (!activeRoom.assignedTo) {
      try {
        await supportBotService.handleMessage({
          roomId: room,
          userId: sender,
          message: msg,
          supportType: activeRoom.supportType || 'orders',
        });
      } catch (botError) {
        // Bot failure must never break the customer's ability to chat.
        // eslint-disable-next-line no-console
        console.error('support.bot.handleMessage error:', botError);
      }
    }
  }

  return { success: true };
};

const adminChatMessages = async (roomId, options) => {
  const limit = options.limit && parseInt(options.limit, 10) > 0 ? parseInt(options.limit, 10) : 10;
  const page = options.page && parseInt(options.page, 10) > 0 ? parseInt(options.page, 10) : 1;
  const skip = (page - 1) * limit;
  const conversionQuery = [
    { $match: { roomId: new mongoose.Types.ObjectId(roomId) } },
    { $sort: { createdAt: -1 } },
    { $skip: skip },
    { $limit: Number(limit) },
    {
      $lookup: {
        from: 'users',
        localField: 'senderId',
        foreignField: '_id',
        as: 'users',
      },
    },
    {
      $unwind: {
        path: '$users',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $project: {
        _id: 0,
        id: '$_id',
        roomId: 1,
        senderId: 1,
        message: 1,
        messageType: 1,
        metadata: 1,
        createdAt: 1,
        sender: {
          id: { $ifNull: ['$users._id', ''] },
          image: { $ifNull: ['$users.image', ''] },
          firstName: { $ifNull: ['$users.firstName', ''] },
          lastName: { $ifNull: ['$users.lastName', ''] },
          role: { $ifNull: ['$users.role', ''] },
        },
      },
    },
  ];
  const chats = await SupportChatConversion.aggregate(conversionQuery);
  const totalResults = await SupportChatConversion.countDocuments({
    roomId: new mongoose.Types.ObjectId(roomId),
  });
  return Promise.all([chats, totalResults]).then(() => {
    const totalPages = Math.ceil(totalResults / limit);
    const result = {
      roomId,
      chats,
      page,
      limit,
      totalPages,
      totalResults,
      success: true,
    };
    return Promise.resolve(result);
  });
};

const cityzenChatMessages = async (roomId, options) => {
  const limit = options.limit && parseInt(options.limit, 10) > 0 ? parseInt(options.limit, 10) : 10;
  const page = options.page && parseInt(options.page, 10) > 0 ? parseInt(options.page, 10) : 1;
  const skip = (page - 1) * limit;
  const conversionQuery = [
    { $match: { roomId: new mongoose.Types.ObjectId(roomId) } },
    { $sort: { createdAt: -1 } },
    { $skip: skip },
    { $limit: Number(limit) },
    {
      $lookup: {
        from: 'users',
        localField: 'senderId',
        foreignField: '_id',
        as: 'users',
      },
    },
    {
      $unwind: {
        path: '$users',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $project: {
        _id: 0,
        id: '$_id',
        roomId: 1,
        senderId: 1,
        message: 1,
        messageType: 1,
        metadata: 1,
        createdAt: 1,
        sender: {
          id: { $ifNull: ['$users._id', ''] },
          image: { $ifNull: ['$users.image', ''] },
          firstName: { $ifNull: ['$users.firstName', ''] },
          lastName: { $ifNull: ['$users.lastName', ''] },
          role: { $ifNull: ['$users.role', ''] },
        },
      },
    },
  ];
  const chats = await SupportChatConversion.aggregate(conversionQuery);
  const totalResults = await SupportChatConversion.countDocuments({
    roomId: new mongoose.Types.ObjectId(roomId),
  });
  return Promise.all([chats, totalResults]).then(() => {
    const totalPages = Math.ceil(totalResults / limit);
    const result = {
      roomId,
      chats,
      page,
      limit,
      totalPages,
      totalResults,
      success: true,
    };
    return Promise.resolve(result);
  });
};

const exportCollection = async () => {
  const query = [
    {
      $lookup: {
        from: 'users',
        localField: 'senderId',
        foreignField: '_id',
        as: 'users',
      },
    },
    {
      $unwind: {
        path: '$users',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $project: {
        _id: 0,
        id: '$_id',
        roomId: 1,
        senderId: 1,
        message: 1,
        messageType: 1,
        metadata: 1,
        createdAt: 1,
        sender: {
          id: { $ifNull: ['$users._id', ''] },
          firstName: { $ifNull: ['$users.firstName', ''] },
          lastName: { $ifNull: ['$users.lastName', ''] },
          role: { $ifNull: ['$users.role', ''] },
        },
      },
    },
  ];
  const results = await SupportChatConversion.aggregate(query);
  return results;
};

const exportRawCollection = async () => {
  const results = await SupportChatConversion.find();
  return results;
};

module.exports = {
  getMessages,
  saveNewMessage,
  saveSupportMessage,
  adminChatMessages,
  cityzenChatMessages,
  exportCollection,
  exportRawCollection,
};

