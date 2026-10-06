const { SupportChatRoom, SupportConfig, SupportTransferLog, User } = require('../models');

async function getConfig() {
  let config = await SupportConfig.findOne().lean();
  if (!config) {
    config = await SupportConfig.create({});
    config = config.toJSON();
  }
  return config;
}

async function runAutoEscalation() {
  const config = await getConfig();
  if (!config.autoEscalation || !config.autoEscalation.enabled) {
    return { escalated: 0, skipped: 'disabled' };
  }

  const threshold = new Date(Date.now() - config.autoEscalation.afterMinutes * 60 * 1000);
  const chats = await SupportChatRoom.find({
    status: { $ne: 'resolved' },
    escalated: false,
    assignedAt: { $lt: threshold },
    assignedTo: { $ne: null },
  }).populate('assignedTo', 'firstName lastName').lean();

  let escalated = 0;
  for (const chat of chats) {
    await SupportChatRoom.findByIdAndUpdate(chat._id, {
      $set: {
        escalated: true,
        escalatedIntent: 'auto_escalation',
      },
    });

    await SupportTransferLog.create({
      chatId: chat._id,
      fromAgent: chat.assignedTo?._id || null,
      toAgent: null,
      performedBy: null,
      action: 'auto_escalate',
      reason: `Auto-escalated after ${config.autoEscalation.afterMinutes} minutes without resolution`,
    });

    if (config.autoEscalation.escalateTo === 'manager') {
      const managers = await User.find({ role: 'support_manager' }).lean();
      console.log(`[AUTO-ESCALATION] Chat ${chat._id} escalated to ${managers.length} manager(s)`);
    }

    escalated++;
  }

  return { escalated };
}

async function runAutoClose() {
  const config = await getConfig();
  if (!config.autoClose || !config.autoClose.enabled) {
    return { closed: 0, skipped: 'disabled' };
  }

  let closed = 0;

  if (config.autoClose.afterResolvedMinutes > 0) {
    const resolvedThreshold = new Date(Date.now() - config.autoClose.afterResolvedMinutes * 60 * 1000);
    const resolvedChats = await SupportChatRoom.find({
      status: 'resolved',
      resolvedAt: { $lt: resolvedThreshold },
    }).lean();

    for (const chat of resolvedChats) {
      await SupportChatRoom.findByIdAndUpdate(chat._id, {
        $set: { status: 'closed' },
      });
      closed++;
    }
  }

  if (config.autoClose.afterInactiveMinutes > 0) {
    const inactiveThreshold = new Date(Date.now() - config.autoClose.afterInactiveMinutes * 60 * 1000);
    const inactiveChats = await SupportChatRoom.find({
      status: { $in: ['open', 'in_progress'] },
      updatedAt: { $lt: inactiveThreshold },
      snoozedUntil: { $lt: new Date() },
    }).lean();

    for (const chat of inactiveChats) {
      await SupportChatRoom.findByIdAndUpdate(chat._id, {
        $set: { status: 'closed' },
      });
      closed++;
    }
  }

  return { closed };
}

async function runSlaCheck() {
  const breached = await SupportChatRoom.updateMany(
    { dueAt: { $lt: new Date() }, slaBreached: false, status: { $ne: 'resolved' } },
    { $set: { slaBreached: true } }
  );

  if (breached.modifiedCount > 0) {
    console.log(`[SLA-CHECK] ${breached.modifiedCount} chat(s) breached SLA targets`);
  }

  return { breachedCount: breached.modifiedCount };
}

module.exports = {
  getConfig,
  runAutoEscalation,
  runAutoClose,
  runSlaCheck,
};
