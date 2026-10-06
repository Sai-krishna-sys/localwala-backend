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

/**
 * Auto-assignment engine (spec 18.3–18.5).
 *
 * Three human-assignment paths:
 *   1. Auto-assign   -> system picks the best eligible agent (CAS #1 + #2)
 *   2. Assign to Me  -> available agent manually claims from Shared Queue (CAS #1)
 *   3. Manager       -> assign / reassign / take ownership / unassign
 *
 * Single source of truth: SupportChatRoom.assignedTo (current owner).
 * Workload is a live count-query; capacity is static SupportAgent.maxConcurrentChats.
 */

const mongoose = require('mongoose');
const { SupportChatRoom, SupportChatConversion, SupportAgent, User, PushNotificationToken } = require('../models');
const admin = require('firebase-admin');
const ApiError = require('../utils/ApiError');
const { status: httpStatus } = require('http-status');
const { logTransfer } = require('./support.metrics.service');

const SUPPORT_ROLE = 'supportTeam';

// SLA target minutes per priority (configurable defaults). Priority is read from
// the chat; a high/urgent chat gets a tighter dueAt.
const SLA_MINUTES_BY_PRIORITY = {
  normal: 20,
  high: 10,
  urgent: 5,
};

const slaDueAtForPriority = (priority, from = new Date()) => {
  const minutes = SLA_MINUTES_BY_PRIORITY[priority] || SLA_MINUTES_BY_PRIORITY.normal;
  return new Date(from.getTime() + minutes * 60 * 1000);
};

// ---- Eligibility (18.3.2) ----
const agentEligibilityQuery = (excludeAgentId) => {
  const query = {
    acceptingChats: true,
    isOnline: true,
    isBlocked: false,
    isDeactivated: false,
    isManager: { $ne: true },
  };
  if (excludeAgentId) {
    query.user = { $ne: new mongoose.Types.ObjectId(excludeAgentId) };
  }
  return query;
};

// Live workload per agent = count of non-resolved chats owned by them.
const activeChatCount = async (agentId) =>
  SupportChatRoom.countDocuments({
    assignedTo: new mongoose.Types.ObjectId(agentId),
    status: { $in: ['open', 'in_progress'] },
  });

// Best-agent selection among eligible (18.3.3):
// 1) lowest live workload, 2) fairness (fewest recent), 3) round-robin tie-break.
const selectBestAgent = async (excludeAgentId) => {
  const candidates = await SupportAgent.find(agentEligibilityQuery(excludeAgentId)).lean();
  if (!candidates.length) return null;

  const scored = [];
  for (const agent of candidates) {
    const workload = await activeChatCount(agent.user);
    scored.push({
      agent,
      workload,
      lastAssignedAt: agent.lastAssignedAt ? new Date(agent.lastAssignedAt).getTime() : 0,
    });
  }

  scored.sort((a, b) => {
    if (a.workload !== b.workload) return a.workload - b.workload;
    if (a.lastAssignedAt !== b.lastAssignedAt) return a.lastAssignedAt - b.lastAssignedAt;
    return String(a.agent._id).localeCompare(String(b.agent._id));
  });

  return scored[0].agent;
};

// CAS #1 — claim the chat (single owner). Returns updated doc or null.
const claimChat = async (chatId, agentId, priority) => {
  return SupportChatRoom.findOneAndUpdate(
    { _id: chatId, assignedTo: null },
    {
      $set: { assignedTo: agentId, assignedAt: new Date(), dueAt: slaDueAtForPriority(priority) },
      $addToSet: { supportTeam: agentId },
      $unset: { escalated: 1, escalatedIntent: 1 },
    },
    { new: true }
  );
};

// CAS #2 — capacity guard against live count at claim time.
const hasCapacity = async (agentId) => {
  const agent = await SupportAgent.findOne({ user: agentId }).lean();
  if (!agent) return false;
  if (agent.isBlocked || agent.isDeactivated || !agent.acceptingChats || !agent.isOnline) {
    return false;
  }
  const active = await activeChatCount(agentId);
  return active < agent.maxConcurrentChats;
};

// Auto-route one chat. Returns { assigned, chatId, agentId }.
const autoAssignChat = async (chatId) => {
  const chat = await SupportChatRoom.findById(chatId);
  if (!chat) return { assigned: false, reason: 'not-found' };
  if (chat.assignedTo) return { assigned: false, chatId, reason: 'already-assigned', agentId: chat.assignedTo };

  const best = await selectBestAgent();
  if (!best) return { assigned: false, chatId, reason: 'no-eligible-agent' };

  if (!(await hasCapacity(best.user))) return { assigned: false, chatId, reason: 'no-capacity' };

  const claimed = await claimChat(chatId, best.user, chat.priority);
  if (!claimed) return { assigned: false, chatId, reason: 'already-assigned' };

  await SupportAgent.updateOne(
    { user: best.user },
    { $set: { lastAssignedAt: new Date() } }
  );

  await logTransfer({ chatRoom: chatId, action: 'auto_assign', toAgent: best.user, performedBy: best.user, supportType: chat.supportType, priority: chat.priority });

  return { assigned: true, chatId, agentId: best.user };
};

// Drain the shared queue

// Drain the shared queue when an agent becomes eligible or periodically.
// Assigns queued (unassigned + escalated) chats in FIFO order while agents remain.
const drainQueue = async ({ limit = 20 } = {}) => {
  const queued = await SupportChatRoom.find({
    assignedTo: null,
    status: { $in: ['open', 'in_progress'] },
  })
    .sort({ createdAt: 1 })
    .limit(limit);

  const assigned = [];
  for (const chat of queued) {
    // Re-check eligible agents each iteration (workloads changed after each claim)
    const best = await selectBestAgent();
    if (!best) break;
    if (!(await hasCapacity(best.user))) break;
    const claimed = await claimChat(chat._id, best.user, chat.priority);
    if (claimed) {
      await SupportAgent.updateOne({ user: best.user }, { $set: { lastAssignedAt: new Date() } });
      await logTransfer({ chatRoom: chat._id, action: 'auto_assign', toAgent: best.user, performedBy: best.user, supportType: chat.supportType, priority: chat.priority });
      assigned.push({ assigned: true, chatId: String(chat._id), agentId: best.user });
    }
  }

  return { assigned, queuedCount: queued.length, success: true };
};

// "Assign to Me" — CAS #1 via an explicit agent.
const assignToMe = async (chatId, agentId) => {
  if (!(await hasCapacity(agentId))) {
    return { success: false, reason: 'at-capacity-or-ineligible' };
  }
  const chat = await SupportChatRoom.findById(chatId).lean();
  const claimed = await claimChat(chatId, agentId, chat && chat.priority);
  if (!claimed) return { success: false, reason: 'already-assigned' };

  await SupportAgent.updateOne({ user: agentId }, { $set: { lastAssignedAt: new Date() } });
  await logTransfer({ chatRoom: chatId, action: 'claim', toAgent: agentId, performedBy: agentId, supportType: chat && chat.supportType, priority: chat && chat.priority });
  return { success: true, chatId, agentId };
};

// Manager override — force assign (bypasses eligibility/capacity).
const managerAssign = async (chatId, agentId) => {
  const chat = await SupportChatRoom.findById(chatId).lean();
  const updated = await SupportChatRoom.findByIdAndUpdate(
    chatId,
    {
      $set: {
        assignedTo: agentId,
        assignedAt: new Date(),
        dueAt: slaDueAtForPriority(chat && chat.priority),
      },
      $addToSet: { supportTeam: agentId },
      $unset: { escalated: 1, escalatedIntent: 1 },
    },
    { new: true }
  );
  if (!updated) return { success: false, reason: 'not-found' };
  await SupportAgent.updateOne({ user: agentId }, { $set: { lastAssignedAt: new Date() } });
  await logTransfer({ chatRoom: chatId, action: 'take_ownership', toAgent: agentId, performedBy: agentId, supportType: chat && chat.supportType, priority: chat && chat.priority });
  return { success: true, chatId, agentId };
};

// Manager override — reassign from one agent to another (bypasses eligibility).
const managerReassign = async (chatId, fromAgentId, toAgentId, options = {}) => {
  const chat = await SupportChatRoom.findById(chatId).lean();
  const updated = await SupportChatRoom.findByIdAndUpdate(
    chatId,
    {
      $set: {
        assignedTo: toAgentId,
        assignedAt: new Date(),
        dueAt: slaDueAtForPriority(chat && chat.priority),
      },
      $addToSet: { supportTeam: toAgentId },
      $unset: { escalated: 1, escalatedIntent: 1 },
    },
    { new: true }
  );
  if (!updated) return { success: false, reason: 'not-found' };
  await SupportAgent.updateOne({ user: toAgentId }, { $set: { lastAssignedAt: new Date() } });
  await logTransfer({
    chatRoom: chatId,
    action: 'reassign',
    fromAgent: fromAgentId,
    toAgent: toAgentId,
    performedBy: options.performedBy || toAgentId,
    supportType: chat && chat.supportType,
    priority: chat && chat.priority,
    reason: options.reason || null,
  });
  return { success: true, chatId, agentId: toAgentId };
};

// Manager override — unassign (return chat to the shared queue).
const managerUnassign = async (chatId) => {
  const updated = await SupportChatRoom.findByIdAndUpdate(
    chatId,
    {
      $unset: { assignedTo: 1, assignedAt: 1 },
      $set: { status: 'open' },
    },
    { new: true }
  );
  if (!updated) return { success: false, reason: 'not-found' };
  await logTransfer({ chatRoom: chatId, action: 'unassign', fromAgent: updated.assignedTo, performedBy: updated.assignedTo, supportType: updated.supportType, priority: updated.priority });
  return { success: true, chatId };
};

// Badge / unread count per agent: chats owned + waiting in the shared queue.
const agentBadgeCount = async (agentId) => {
  const myChats = await SupportChatRoom.countDocuments({
    assignedTo: new mongoose.Types.ObjectId(agentId),
    status: { $in: ['open', 'in_progress'] },
  });
  const waiting = await SupportChatRoom.countDocuments({
    assignedTo: null,
    status: { $in: ['open', 'in_progress'] },
  });
  return { myChats, waiting, success: true };
};

// Shared queue (waiting pool) list.
const unassignedList = async (options = {}) => {
  const limit = options.limit && parseInt(options.limit, 10) > 0 ? parseInt(options.limit, 10) : 20;
  const page = options.page && parseInt(options.page, 10) > 0 ? parseInt(options.page, 10) : 1;
  const skip = (page - 1) * limit;
  const results = await SupportChatRoom.find({
    assignedTo: null,
    status: { $in: ['open', 'in_progress'] },
  })
    .sort({ createdAt: 1 })
    .skip(skip)
    .limit(limit);
  const totalResults = await SupportChatRoom.countDocuments({
    assignedTo: null,
    status: { $in: ['open', 'in_progress'] },
  });
  return {
    results,
    page,
    limit,
    totalPages: Math.ceil(totalResults / limit),
    totalResults,
    success: true,
  };
};

// ---- FCM push helpers (spec 18.5.1) ----
const pushToUser = async (userId, title, body, data = {}) => {
  const tokens = await PushNotificationToken.find(
    { user: new mongoose.Types.ObjectId(userId) },
    { token: 1 }
  );
  if (!tokens.length) return { sent: 0 };
  const payload = {
    notification: { title, body },
    data: { click_action: 'FLUTTER_NOTIFICATION_CLICK', type: 'support', ...data },
    android: {
      priority: 'high',
      notification: { channelId: 'high_importance_channel', priority: 'max', clickAction: 'FLUTTER_NOTIFICATION_CLICK' },
    },
    tokens: tokens.map((t) => t.token),
  };
  try {
    const result = await admin.messaging().sendEachForMulticast(payload);
    return { sent: result.successCount };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('support.assignment pushToUser error:', error);
    return { sent: 0, error: error.message };
  }
};

const notifyAgentAssigned = async (agentId, chat) => {
  await pushToUser(agentId, 'New chat assigned', `A new support chat has been assigned to you.`, {
    type: 'new_chat',
    roomId: String(chat._id),
  });
};

const notifySlaBreach = async (agentId, chat) => {
  await pushToUser(agentId, 'SLA breach', 'A chat is overdue — please take action.', {
    type: 'sla_breach',
    roomId: String(chat._id),
  });
};

const notifyQueueWaiting = async (agentId, count) => {
  await pushToUser(agentId, 'Chats waiting', `${count} chats are waiting in the queue for a free agent.`, {
    type: 'queue_waiting',
    count: String(count),
  });
};

const notifyAgentJoined = async (userId, roomId) => {
  await pushToUser(userId, 'Agent on it', 'A support agent is now helping you.', {
    type: 'agent_joined',
    roomId: String(roomId),
  });
};

// Helper: send a new message into the chat and keep it internally consistent.
const addSystemMessage = async (roomId, senderId, text) => {
  return SupportChatConversion.create({
    roomId,
    senderId,
    message: text,
    messageType: 'system',
  });
};

// B3: Periodic monitor — drain the shared queue and flag SLA breaches.
// Called from the existing hourly cron (cron.job.scheduler.service.js).
const runSlaAndQueueMonitor = async () => {
  const results = { drained: 0, slaBreaches: 0, queuedWaiting: 0 };

  // 1) Drain queued chats to any newly-eligible agent.
  try {
    const drain = await drainQueue({ limit: 50 });
    results.drained = (drain.assigned || []).length;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('support.assignment drainQueue error:', e);
  }

  // 2) SLA breaches: chats with a dueAt that has passed and still open/in_progress.
  try {
    const overdue = await SupportChatRoom.find({
      dueAt: { $lte: new Date() },
      status: { $in: ['open', 'in_progress'] },
    }).limit(50);
    for (const chat of overdue) {
      if (chat.assignedTo) {
        await notifySlaBreach(chat.assignedTo, chat);
      }
      results.slaBreaches += 1;
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('support.assignment sla monitor error:', e);
  }

  // 3) Notify eligible-but-idle agents when chats are waiting (queue standing).
  try {
    const waiting = await SupportChatRoom.countDocuments({
      assignedTo: null,
      status: { $in: ['open', 'in_progress'] },
    });
    results.queuedWaiting = waiting;
    if (waiting > 0) {
      const idleAgents = await SupportAgent.find(agentEligibilityQuery()).lean();
      for (const agent of idleAgents) {
        await notifyQueueWaiting(agent.user, waiting);
      }
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('support.assignment queue-standing notify error:', e);
  }

  return results;
};

// D2: Manager sets/overrides chat priority, recomputing the SLA deadline.
const setChatPriority = async (chatId, priority) => {
  if (!['normal', 'high', 'urgent'].includes(priority)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'priority must be normal|high|urgent');
  }
  const chat = await SupportChatRoom.findByIdAndUpdate(
    chatId,
    { $set: { priority, dueAt: slaDueAtForPriority(priority) } },
    { new: true }
  );
  return { success: true, data: chat };
};

// D2: Manager workload panel — all agents + live active chat counts + status.
const managerWorkload = async () => {
  const agents = await SupportAgent.find().lean();
  const userIds = agents.map((a) => a.user);
  const users = await User.find({ _id: { $in: userIds } }, { firstName: 1, lastName: 1, image: 1, email: 1 }).lean();
  const userMap = {};
  users.forEach((u) => {
    userMap[String(u._id)] = u;
  });

  const counts = await SupportChatRoom.aggregate([
    { $match: { assignedTo: { $ne: null }, status: { $in: ['open', 'in_progress'] } } },
    { $group: { _id: '$assignedTo', active: { $sum: 1 } } },
  ]);
  const countMap = {};
  counts.forEach((c) => {
    countMap[String(c._id)] = c.active;
  });

  const results = agents.map((a) => {
    const u = userMap[String(a.user)] || {};
    return {
      user: a.user,
      firstName: u.firstName || '',
      lastName: u.lastName || '',
      image: u.image || '',
      email: u.email || '',
      isOnline: a.isOnline,
      acceptingChats: a.acceptingChats,
      maxConcurrentChats: a.maxConcurrentChats,
      active: countMap[String(a.user)] || 0,
      isBlocked: a.isBlocked,
      isDeactivated: a.isDeactivated,
      isManager: a.isManager || false,
      lastOnlineAt: a.lastOnlineAt,
    };
  });

  return { success: true, results };
};

module.exports = {
  SUPPORT_ROLE,
  agentEligibilityQuery,
  activeChatCount,
  selectBestAgent,
  claimChat,
  hasCapacity,
  autoAssignChat,
  drainQueue,
  assignToMe,
  managerAssign,
  managerReassign,
  managerUnassign,
  setChatPriority,
  managerWorkload,
  agentBadgeCount,
  unassignedList,
  pushToUser,
  notifyAgentAssigned,
  notifySlaBreach,
  notifyQueueWaiting,
  notifyAgentJoined,
  addSystemMessage,
  runSlaAndQueueMonitor,
};
