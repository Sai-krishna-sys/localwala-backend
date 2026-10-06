const SupportChatRoom = require('../models/support.chat.room.model');
const SupportTransferLog = require('../models/support.transfer.log.model');
const SupportAgent = require('../models/support.agent.model');

const agentPerformance = async (options = {}) => {
  const { from, to, agentId } = options;

  const matchQuery = { status: 'resolved', resolvedAt: { $ne: null } };
  if (agentId) {
    matchQuery.assignedTo = agentId;
  }
  if (from || to) {
    matchQuery.resolvedAt = {};
    if (from) matchQuery.resolvedAt.$gte = new Date(from);
    if (to) matchQuery.resolvedAt.$lte = new Date(to);
  }

  const agentMetrics = await SupportChatRoom.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: '$assignedTo',
        totalResolved: { $sum: 1 },
        avgResolutionMinutes: {
          $avg: {
            $divide: [
              { $subtract: ['$resolvedAt', '$assignedAt'] },
              60000,
            ],
          },
        },
        avgFirstResponseMinutes: {
          $avg: {
            $cond: [
              { $ne: ['$firstHumanReplyAt', null] },
              { $divide: [{ $subtract: ['$firstHumanReplyAt', '$createdAt'] }, 60000] },
              null,
            ],
          },
        },
        avgAgentResponseMinutes: {
          $avg: {
            $cond: [
              { $ne: ['$firstAgentReplyAt', null] },
              { $divide: [{ $subtract: ['$firstAgentReplyAt', '$assignedAt'] }, 60000] },
              null,
            ],
          },
        },
        avgCsatRating: { $avg: '$csatRating' },
        csatCount: { $sum: { $cond: [{ $ne: ['$csatRating', null] }, 1, 0] } },
        slaCompliant: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $ne: ['$dueAt', null] },
                  { $lte: ['$resolvedAt', '$dueAt'] },
                ],
              },
              1,
              0,
            ],
          },
        },
        totalWithDueAt: {
          $sum: { $cond: [{ $ne: ['$dueAt', null] }, 1, 0] },
        },
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user',
      },
    },
    { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 1,
        firstName: '$user.firstName',
        lastName: '$user.lastName',
        image: '$user.image',
        email: '$user.email',
        totalResolved: 1,
        avgResolutionMinutes: { $round: ['$avgResolutionMinutes', 1] },
        avgFirstResponseMinutes: { $round: ['$avgFirstResponseMinutes', 1] },
        avgAgentResponseMinutes: { $round: ['$avgAgentResponseMinutes', 1] },
        avgCsatRating: { $round: ['$avgCsatRating', 2] },
        csatCount: 1,
        slaCompliant: 1,
        totalWithDueAt: 1,
        slaCompliancePercent: {
          $cond: [
            { $eq: ['$totalWithDueAt', 0] },
            null,
            { $round: [{ $multiply: [{ $divide: ['$slaCompliant', '$totalWithDueAt'] }, 100] }, 1] },
          ],
        },
      },
    },
    { $sort: { totalResolved: -1 } },
  ]);

  const summary = await SupportChatRoom.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: null,
        totalResolved: { $sum: 1 },
        avgResolutionMinutes: {
          $avg: {
            $divide: [
              { $subtract: ['$resolvedAt', '$assignedAt'] },
              60000,
            ],
          },
        },
        avgFirstResponseMinutes: {
          $avg: {
            $cond: [
              { $ne: ['$firstHumanReplyAt', null] },
              { $divide: [{ $subtract: ['$firstHumanReplyAt', '$createdAt'] }, 60000] },
              null,
            ],
          },
        },
        avgAgentResponseMinutes: {
          $avg: {
            $cond: [
              { $ne: ['$firstAgentReplyAt', null] },
              { $divide: [{ $subtract: ['$firstAgentReplyAt', '$assignedAt'] }, 60000] },
              null,
            ],
          },
        },
        avgCsatRating: { $avg: '$csatRating' },
        csatCount: { $sum: { $cond: [{ $ne: ['$csatRating', null] }, 1, 0] } },
      },
    },
  ]);

  return {
    agents: agentMetrics,
    summary: summary[0] || { totalResolved: 0, avgResolutionMinutes: 0, avgFirstResponseMinutes: 0, avgAgentResponseMinutes: 0, avgCsatRating: 0, csatCount: 0 },
  };
};

const transferHistory = async (options = {}) => {
  const { page = 1, limit = 20, agentId, chatId, action } = options;

  const matchQuery = {};
  if (agentId) {
    matchQuery.$or = [{ fromAgent: agentId }, { toAgent: agentId }];
  }
  if (chatId) {
    matchQuery.chatRoom = chatId;
  }
  if (action) {
    matchQuery.action = action;
  }

  const skip = (Math.max(1, page) - 1) * limit;
  const [logs, totalResults] = await Promise.all([
    SupportTransferLog.find(matchQuery)
      .populate('chatRoom', 'supportType status priority')
      .populate('fromAgent', 'firstName lastName image')
      .populate('toAgent', 'firstName lastName image')
      .populate('performedBy', 'firstName lastName image')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    SupportTransferLog.countDocuments(matchQuery),
  ]);

  return { results: logs, totalResults, page: Number(page), limit: Number(limit) };
};

const logTransfer = async (data) => {
  try {
    await SupportTransferLog.create(data);
  } catch (err) {
    console.error('[SupportMetrics] Failed to log transfer:', err.message);
  }
};

module.exports = { agentPerformance, transferHistory, logTransfer };
