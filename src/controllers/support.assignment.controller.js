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

const { status: httpStatus } = require('http-status');
const catchAsync = require('../utils/catchAsync');
const pick = require('../utils/pick');
const { supportAssignmentService } = require('../services');
const ApiError = require('../utils/ApiError');

const routeChat = catchAsync(async (req, res) => {
  const { chatId } = req.body;
  if (!chatId) throw new ApiError(httpStatus.BAD_REQUEST, 'chatId is required');
  const result = await supportAssignmentService.autoAssignChat(chatId);
  // B3: FCM push to agent when auto-assigned
  if (result.assigned && result.agentId) {
    try {
      const { SupportChatRoom } = require('../models');
      const chat = await SupportChatRoom.findById(chatId).lean();
      await supportAssignmentService.notifyAgentAssigned(result.agentId, chat || { _id: chatId });
      await supportAssignmentService.notifyAgentJoined(chat ? chat.userId : null, chatId);
    } catch (e) {
      // Push failure must never block the response
    }
  }
  res.send(result);
});

const claimChat = catchAsync(async (req, res) => {
  const { chatId, agentId } = req.body;
  if (!chatId || !agentId) throw new ApiError(httpStatus.BAD_REQUEST, 'chatId and agentId are required');
  const result = await supportAssignmentService.assignToMe(chatId, agentId);
  // B3: FCM push to agent when claimed
  if (result.success && result.agentId) {
    try {
      const { SupportChatRoom } = require('../models');
      const chat = await SupportChatRoom.findById(chatId).lean();
      await supportAssignmentService.notifyAgentAssigned(result.agentId, chat || { _id: chatId });
      await supportAssignmentService.notifyAgentJoined(chat ? chat.userId : null, chatId);
    } catch (e) {
      // Push failure must never block the response
    }
  }
  res.send(result);
});

const reassignChat = catchAsync(async (req, res) => {
  const { chatId, fromAgentId, toAgentId, reason } = req.body;
  if (!chatId || !toAgentId) throw new ApiError(httpStatus.BAD_REQUEST, 'chatId and toAgentId are required');
  const result = await supportAssignmentService.managerReassign(chatId, fromAgentId, toAgentId, { reason, performedBy: req.user.id });
  // B3: FCM push to new agent when reassigned
  if (result.success && result.agentId) {
    try {
      const { SupportChatRoom } = require('../models');
      const chat = await SupportChatRoom.findById(chatId).lean();
      await supportAssignmentService.notifyAgentAssigned(result.agentId, chat || { _id: chatId });
    } catch (e) {
      // Push failure must never block the response
    }
  }
  res.send(result);
});

const takeOwnership = catchAsync(async (req, res) => {
  const { chatId, agentId } = req.body;
  if (!chatId || !agentId) throw new ApiError(httpStatus.BAD_REQUEST, 'chatId and agentId are required');
  const result = await supportAssignmentService.managerAssign(chatId, agentId);
  res.send(result);
});

const unassignChat = catchAsync(async (req, res) => {
  const { chatId } = req.body;
  if (!chatId) throw new ApiError(httpStatus.BAD_REQUEST, 'chatId is required');
  const result = await supportAssignmentService.managerUnassign(chatId);
  res.send(result);
});

const drainQueue = catchAsync(async (req, res) => {
  const options = pick(req.body, ['limit']);
  const result = await supportAssignmentService.drainQueue(options);
  res.send(result);
});

const agentBadgeCount = catchAsync(async (req, res) => {
  const { agentId } = req.params;
  const result = await supportAssignmentService.agentBadgeCount(agentId);
  res.send(result);
});

const unassignedList = catchAsync(async (req, res) => {
  const options = pick(req.query, ['limit', 'page']);
  const result = await supportAssignmentService.unassignedList(options);
  res.send(result);
});

const getAgentStatus = catchAsync(async (req, res) => {
  const { agentId } = req.params;
  const { SupportAgent } = require('../models');
  const agent = await SupportAgent.findOne({ user: agentId }).lean();
  res.send({ success: true, data: agent || null });
});

const updateAgentStatus = catchAsync(async (req, res) => {
  const { agentId } = req.params;
  const { acceptingChats, isOnline, maxConcurrentChats } = req.body;
  const { SupportAgent } = require('../models');
  const update = {};
  if (acceptingChats !== undefined) update.acceptingChats = acceptingChats;
  if (isOnline !== undefined) update.isOnline = isOnline;
  if (maxConcurrentChats !== undefined) update.maxConcurrentChats = maxConcurrentChats;
  if (isOnline === true) update.lastOnlineAt = new Date();

  const agent = await SupportAgent.findOneAndUpdate({ user: agentId }, { $set: update }, { new: true, upsert: true });
  if (agent) drainIfAgentEligible(agentId);
  res.send({ success: true, data: agent });
});

const setPriority = catchAsync(async (req, res) => {
  const { chatId, priority } = req.body;
  if (!chatId || !priority) throw new ApiError(httpStatus.BAD_REQUEST, 'chatId and priority are required');
  const result = await supportAssignmentService.setChatPriority(chatId, priority);
  res.send(result);
});

const managerWorkload = catchAsync(async (req, res) => {
  const result = await supportAssignmentService.managerWorkload();
  res.send(result);
});

const getMyAgentStatus = catchAsync(async (req, res) => {
  const { SupportAgent } = require('../models');
  const agent = await SupportAgent.findOne({ user: req.user.id }).lean();
  res.send({ success: true, data: agent || null });
});

// Fire-and-forget: when an agent becomes Online+Accepting with free capacity,
// drain the shared Waiting queue to them in real time (instead of yearly cron wait).
const drainIfAgentEligible = (agentId) => {
  try {
    const { SupportAgent } = require('../models');
    SupportAgent.findOne({ user: agentId })
      .lean()
      .then((agent) => {
        if (agent && agent.acceptingChats && agent.isOnline && !agent.isBlocked && !agent.isDeactivated) {
          return supportAssignmentService.drainQueue({ limit: 20 });
        }
        return null;
      })
      .catch((e) => {
        // eslint-disable-next-line no-console
        console.error('support.assignment drain-on-status error:', e);
      });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('support.assignment drain-on-status error:', e);
  }
};

const updateMyAgentStatus = catchAsync(async (req, res) => {
  const { acceptingChats, isOnline, maxConcurrentChats } = req.body;
  const { SupportAgent } = require('../models');
  const update = {};
  if (acceptingChats !== undefined) update.acceptingChats = acceptingChats;
  if (isOnline !== undefined) update.isOnline = isOnline;
  if (maxConcurrentChats !== undefined) update.maxConcurrentChats = maxConcurrentChats;
  if (isOnline === true) update.lastOnlineAt = new Date();

  const agent = await SupportAgent.findOneAndUpdate(
    { user: req.user.id },
    { $set: update },
    { new: true, upsert: true }
  );
  if (agent) drainIfAgentEligible(req.user.id);
  res.send({ success: true, data: agent });
});

const agentPerformance = catchAsync(async (req, res) => {
  const { agentPerformance: agentPerformanceService } = require('../services/support.metrics.service');
  const { from, to, agentId } = req.query;
  const result = await agentPerformanceService({ from, to, agentId });
  res.send({ success: true, data: result });
});

const transferHistory = catchAsync(async (req, res) => {
  const { transferHistory: transferHistoryService } = require('../services/support.metrics.service');
  const { page, limit, agentId, chatId, action } = req.query;
  const result = await transferHistoryService({ page, limit, agentId, chatId, action });
  res.send({ success: true, data: result });
});

const escalationQueue = catchAsync(async (req, res) => {
  const { SupportChatRoom } = require('../models');
  const { page = 1, limit = 20 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const query = {
    status: { $ne: 'resolved' },
    $or: [
      { escalated: true },
      { slaBreached: true },
      { dueAt: { $lt: new Date() } },
      { priority: 'urgent' },
    ],
  };
  const [chats, total] = await Promise.all([
    SupportChatRoom.find(query)
      .populate('userId', 'firstName lastName image contactNumber contactEmail countryCode')
      .populate('assignedTo', 'firstName lastName image')
      .populate('supportTeam', 'firstName lastName image')
      .sort({ dueAt: 1, updatedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    SupportChatRoom.countDocuments(query),
  ]);
  res.send({ success: true, data: { chats, totalResults: total, page: parseInt(page), limit: parseInt(limit) } });
});

const setSlaTarget = catchAsync(async (req, res) => {
  const { chatId, slaTargetMinutes } = req.body;
  if (!chatId) throw new ApiError(httpStatus.BAD_REQUEST, 'chatId is required');
  const { SupportChatRoom } = require('../models');
  const update = {};
  if (slaTargetMinutes !== undefined) {
    update.slaTargetMinutes = slaTargetMinutes;
    update.dueAt = new Date(Date.now() + slaTargetMinutes * 60 * 1000);
  }
  const room = await SupportChatRoom.findByIdAndUpdate(chatId, { $set: update }, { new: true });
  if (!room) throw new ApiError(httpStatus.NOT_FOUND, 'Chat not found');
  res.send({ success: true, data: { dueAt: room.dueAt, slaTargetMinutes: room.slaTargetMinutes } });
});

const triggerSlaCheck = catchAsync(async (req, res) => {
  const { SupportChatRoom } = require('../models');
  const breached = await SupportChatRoom.updateMany(
    { dueAt: { $lt: new Date() }, slaBreached: false, status: { $ne: 'resolved' } },
    { $set: { slaBreached: true } }
  );
  res.send({ success: true, data: { breachedCount: breached.modifiedCount } });
});

const snoozeChat = catchAsync(async (req, res) => {
  const { chatId, hours } = req.body;
  if (!chatId || !hours) throw new ApiError(httpStatus.BAD_REQUEST, 'chatId and hours are required');
  const { SupportChatRoom } = require('../models');
  const snoozedUntil = new Date(Date.now() + hours * 60 * 60 * 1000);
  const updated = await SupportChatRoom.findByIdAndUpdate(
    chatId,
    { $set: { snoozedUntil, snoozedBy: req.user.id } },
    { new: true }
  );
  if (!updated) throw new ApiError(httpStatus.NOT_FOUND, 'Chat not found');
  res.send({ success: true, snoozedUntil: updated.snoozedUntil });
});

const getConfig = catchAsync(async (req, res) => {
  const automationService = require('../services/support.automation.service');
  const config = await automationService.getConfig();
  res.send({ success: true, data: config });
});

const updateConfig = catchAsync(async (req, res) => {
  const { SupportConfig } = require('../models');
  const update = req.body;
  const config = await SupportConfig.findOneAndUpdate({}, { $set: update }, { new: true, upsert: true });
  res.send({ success: true, data: config });
});

const runAutomation = catchAsync(async (req, res) => {
  const automationService = require('../services/support.automation.service');
  const [sla, escalation, autoClose] = await Promise.all([
    automationService.runSlaCheck(),
    automationService.runAutoEscalation(),
    automationService.runAutoClose(),
  ]);
  res.send({
    success: true,
    data: { sla, escalation, autoClose },
  });
});

const bulkAssign = catchAsync(async (req, res) => {
  const { chatIds, agentId } = req.body;
  if (!chatIds || !Array.isArray(chatIds) || chatIds.length === 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'chatIds array is required');
  }
  if (!agentId) throw new ApiError(httpStatus.BAD_REQUEST, 'agentId is required');
  const { SupportChatRoom } = require('../models');
  const result = await SupportChatRoom.updateMany(
    { _id: { $in: chatIds } },
    { $set: { assignedTo: agentId, assignedAt: new Date(), status: 'in_progress' } }
  );
  res.send({ success: true, data: { updated: result.modifiedCount } });
});

const bulkClose = catchAsync(async (req, res) => {
  const { chatIds } = req.body;
  if (!chatIds || !Array.isArray(chatIds) || chatIds.length === 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'chatIds array is required');
  }
  const { SupportChatRoom } = require('../models');
  const result = await SupportChatRoom.updateMany(
    { _id: { $in: chatIds } },
    { $set: { status: 'closed', resolvedAt: new Date(), resolvedBy: req.user.id } }
  );
  res.send({ success: true, data: { closed: result.modifiedCount } });
});

const bulkTag = catchAsync(async (req, res) => {
  const { chatIds, tag } = req.body;
  if (!chatIds || !Array.isArray(chatIds) || !tag) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'chatIds array and tag are required');
  }
  const { SupportChatRoom } = require('../models');
  const result = await SupportChatRoom.updateMany(
    { _id: { $in: chatIds } },
    { $addToSet: { tags: tag } }
  );
  res.send({ success: true, data: { tagged: result.modifiedCount } });
});

const joinChat = catchAsync(async (req, res) => {
  const { chatId } = req.body;
  if (!chatId) throw new ApiError(httpStatus.BAD_REQUEST, 'chatId is required');
  const { SupportChatRoom } = require('../models');
  const room = await SupportChatRoom.findById(chatId);
  if (!room) throw new ApiError(httpStatus.NOT_FOUND, 'Chat not found');
  if (room.supportTeam.includes(req.user.id)) {
    return res.send({ success: true, message: 'already_joined' });
  }
  const updated = await SupportChatRoom.findByIdAndUpdate(
    chatId,
    { $addToSet: { supportTeam: req.user.id } },
    { new: true }
  );
  if (updated.assignedTo && updated.assignedTo.toString() === req.user.id) {
    return res.send({ success: true, message: 'already_assigned' });
  }
  if (!updated.assignedTo) {
    await SupportChatRoom.findByIdAndUpdate(chatId, {
      $set: { assignedTo: req.user.id, assignedAt: new Date(), status: 'in_progress' },
    });
  }
  res.send({ success: true, message: 'joined_chat' });
});

module.exports = {
  routeChat,
  claimChat,
  reassignChat,
  takeOwnership,
  unassignChat,
  drainQueue,
  agentBadgeCount,
  unassignedList,
  getAgentStatus,
  updateAgentStatus,
  setPriority,
  managerWorkload,
  getMyAgentStatus,
  updateMyAgentStatus,
  agentPerformance,
  transferHistory,
  escalationQueue,
  setSlaTarget,
  triggerSlaCheck,
  snoozeChat,
  getConfig,
  updateConfig,
  runAutomation,
  bulkAssign,
  bulkClose,
  bulkTag,
  joinChat,
};
