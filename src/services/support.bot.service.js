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
 * Support Bot — same-thread rule-based bot (spec 18.2, 18.6).
 *
 * The bot runs entirely on the backend. It writes replies into the SAME
 * SupportChatConversion thread the agents see, so handoff is free:
 * if the bot can't resolve, it sets metadata.escalate = true and the room
 * enters the agent queue with full context.
 */

const mongoose = require('mongoose');
const {
  SupportChatConversion,
  SupportChatRoom,
  Orders,
  RefundRequest,
  DiningBooking,
  UserPurchasedTiffinSubscription,
  Complaints,
  RestaurantComplaints,
} = require('../models');
const { getSocketIO } = require('../config/socket.instance');
const supportAssignmentService = require('./support.assignment.service');

const BOT_SENDER_ID = new mongoose.Types.ObjectId();

const INTENTS = [
  'order_status',
  'track_delivery',
  'refund_status',
  'cancel_order',
  'dining_booking',
  'tiffin_status',
  'complaint_status',
  'escalate',
  'start_over',
];

// Basic rule-based intent classifier (non-LLM, deterministic keyword matching).
const classifyIntent = (message) => {
  const text = String(message || '').toLowerCase();

  if (/(track|where is my order|order status|order.*(status|progress|location))/i.test(text)) {
    return 'order_status';
  }
  if (/(refund|money back|return.*money)/i.test(text)) {
    return 'refund_status';
  }
  if (/(cancel|give up my order)/i.test(text)) {
    return 'cancel_order';
  }
  if (/(booking|reschedule|dining)/i.test(text)) {
    return 'dining_booking';
  }
  if (/(tiffin|subscription|skip|pause)/i.test(text)) {
    return 'tiffin_status';
  }
  if (/(complaint|report|issue|problem)/i.test(text)) {
    return 'complaint_status';
  }
  if (/(agent|human|talk to|start over|menu)/i.test(text) && /(agent|human|talk)/i.test(text)) {
    return 'escalate';
  }
  if (/(start over|menu|options)/i.test(text)) {
    return 'start_over';
  }
  return null;
};

// Main menu forwarded to customers (spec 18.6).
const getMainMenu = () => ({
  text: 'Hi! How can I help you today?',
  quickReplies: [
    { label: 'Track my order', action: 'order_status' },
    { label: 'Refund', action: 'refund_status' },
    { label: 'I have a complaint', action: 'complaint_status' },
    { label: 'Talk to an agent', action: 'escalate' },
  ],
});

// C3: context-aware quick replies per support type (spec 18.6). The set shown
// depends on the entry screen / support type. Every set keeps the escape hatch.
const getQuickRepliesForSupportType = (supportType) => {
  const escape = [
    { label: 'Talk to an agent', action: 'escalate' },
    { label: 'Start over', action: 'start_over' },
  ];
  switch (supportType) {
    case 'orders':
      return [
        { label: 'Where is my order?', action: 'order_status' },
        { label: 'Track delivery', action: 'track_delivery' },
        { label: 'Cancel order', action: 'cancel_order' },
        { label: 'Refund status', action: 'refund_status' },
        ...escape,
      ];
    case 'dining':
      return [
        { label: 'Reschedule booking', action: 'dining_booking' },
        { label: 'Cancel / refund', action: 'cancel_order' },
        { label: 'Location / directions', action: 'dining_booking' },
        ...escape,
      ];
    case 'tiffin_subscription':
      return [
        { label: 'Skip a day', action: 'tiffin_status' },
        { label: 'Pause / cancel', action: 'cancel_order' },
        { label: 'Refund status', action: 'refund_status' },
        ...escape,
      ];
    case 'complaints':
    case 'reports':
    case 'restaurant_complaints':
      return [
        { label: 'Complaint status', action: 'complaint_status' },
        { label: 'Refund / compensation', action: 'refund_status' },
        ...escape,
      ];
    default:
      return escape;
  }
};

// Query live order data (same collections the REST layer reads).
const fetchOrderStatus = async (room) => {
  if (!room || !room.orders) {
    return {
      text: "I couldn't find an order linked to this chat. Could you share your order number or let me connect you to a support agent?",
      quickReplies: [
        { label: 'Talk to an agent', action: 'escalate' },
        { label: 'Start over', action: 'start_over' },
      ],
    };
  }
  const order = await Orders.findById(room.orders).lean();
  if (!order) {
    return { text: "I couldn't find your order.", quickReplies: [] };
  }
  return {
    text: `Your order #${order.orderNo} is currently: ${order.status}.`,
    quickReplies: [
      { label: 'Talk to an agent', action: 'escalate' },
      { label: 'Start over', action: 'start_over' },
    ],
    orderRef: { orderId: String(order._id), status: order.status },
  };
};

// C1: fetch refund status for the linked order
const fetchRefundStatus = async (room) => {
  if (!room || !room.orders) {
    return {
      text: "I couldn't find an order linked to this chat to check refund status. Let me connect you to a support agent who can help.",
      quickReplies: [
        { label: 'Talk to an agent', action: 'escalate' },
        { label: 'Start over', action: 'start_over' },
      ],
    };
  }
  const refund = await RefundRequest.findOne({ order: room.orders }).lean();
  if (!refund) {
    return {
      text: `No refund request found for this order. If you believe you're eligible, I can connect you to an agent.`,
      quickReplies: [
        { label: 'Talk to an agent', action: 'escalate' },
        { label: 'Start over', action: 'start_over' },
      ],
    };
  }
  return {
    text: `Your refund request is currently: ${refund.status}. ${refund.status === 'pending' ? 'It typically takes 3-5 business days to process.' : ''}`,
    quickReplies: [
      { label: 'Talk to an agent', action: 'escalate' },
      { label: 'Start over', action: 'start_over' },
    ],
  };
};

// C1: fetch dining booking status
const fetchDiningBookingStatus = async (room) => {
  if (!room || !room.booking) {
    return {
      text: "I couldn't find a dining booking linked to this chat. Let me connect you to a support agent.",
      quickReplies: [
        { label: 'Talk to an agent', action: 'escalate' },
        { label: 'Start over', action: 'start_over' },
      ],
    };
  }
  const booking = await DiningBooking.findById(room.booking).lean();
  if (!booking) {
    return { text: "I couldn't find your dining booking.", quickReplies: [] };
  }
  return {
    text: `Your dining booking is currently: ${booking.status}.`,
    quickReplies: [
      { label: 'Reschedule booking', action: 'dining_booking' },
      { label: 'Cancel booking', action: 'cancel_order' },
      { label: 'Talk to an agent', action: 'escalate' },
      { label: 'Start over', action: 'start_over' },
    ],
  };
};

// C1: fetch tiffin subscription status
const fetchTiffinStatus = async (room) => {
  if (!room || !room.purchaseSubscription) {
    return {
      text: "I couldn't find a tiffin subscription linked to this chat. Let me connect you to a support agent.",
      quickReplies: [
        { label: 'Talk to an agent', action: 'escalate' },
        { label: 'Start over', action: 'start_over' },
      ],
    };
  }
  const subscription = await UserPurchasedTiffinSubscription.findById(room.purchaseSubscription).lean();
  if (!subscription) {
    return { text: "I couldn't find your tiffin subscription.", quickReplies: [] };
  }
  return {
    text: `Your tiffin subscription is currently: ${subscription.status}.`,
    quickReplies: [
      { label: 'Skip a day', action: 'tiffin_status' },
      { label: 'Pause subscription', action: 'cancel_order' },
      { label: 'Talk to an agent', action: 'escalate' },
      { label: 'Start over', action: 'start_over' },
    ],
  };
};

// C1: fetch complaint status
const fetchComplaintStatus = async (room) => {
  const complaintId = room.complaints || room.restaurantComplaints;
  if (!complaintId) {
    return {
      text: "I couldn't find a complaint linked to this chat. Let me connect you to a support agent.",
      quickReplies: [
        { label: 'Talk to an agent', action: 'escalate' },
        { label: 'Start over', action: 'start_over' },
      ],
    };
  }
  const ComplaintModel = room.complaints ? Complaints : RestaurantComplaints;
  const complaint = await ComplaintModel.findById(complaintId).lean();
  if (!complaint) {
    return { text: "I couldn't find your complaint.", quickReplies: [] };
  }
  return {
    text: `Your complaint "${complaint.title || 'No title'}" is currently: ${complaint.status === false ? 'resolved' : 'open'}.`,
    quickReplies: [
      { label: 'Request refund', action: 'refund_status' },
      { label: 'Talk to an agent', action: 'escalate' },
      { label: 'Start over', action: 'start_over' },
    ],
  };
};

// Write a bot reply into the same SupportChatRoom thread (spec 18.2)
// and push it to the live channel so the customer sees it in real time.
const writeBotReply = async (roomId, payload) => {
  const io = getSocketIO();
  console.log('[BOT-DBG] writeBotReply | roomId=%s io=%s payload="%s"', String(roomId), io ? 'VALID' : 'NULL', payload.text);
  if (io) {
    const room = String(roomId);
    const sockets = await io.in(room).fetchSockets();
    console.log('[BOT-DBG] room=%s socketsInRoom=%d', room, sockets.length);
    io.to(room).emit('botTyping', {
      roomId: String(roomId),
      senderId: BOT_SENDER_ID,
      role: 'bot',
      typing: true,
    });
  }
  await new Promise((resolve) => setTimeout(resolve, 900));

  const message = new SupportChatConversion({
    roomId,
    senderId: BOT_SENDER_ID,
    message: payload.text,
    messageType: 'card',
    metadata: {
      quickReplies: payload.quickReplies || [],
      orderRef: payload.orderRef || null,
      isBotResponse: true,
      escalate: payload.escalate || false,
    },
  });
  await SupportChatConversion.create(message);

  await SupportChatRoom.findByIdAndUpdate(
    roomId,
    {
      lastMessage: payload.text,
      lastMessageType: 'card',
    },
    { new: true }
  );

  // C2: emit to the room so every connected client (customer + admin agent)
  // sees the bot message without a refresh.
  if (io) {
    const botRandomId = new mongoose.Types.ObjectId().toString();
    const room = String(roomId);
    const sockets = await io.in(room).fetchSockets();
    console.log('[BOT-DBG] emit receiveMessage | room=%s socketsInRoom=%d', room, sockets.length);
    io.to(room).emit('receiveMessage', {
      id: String(message._id),
      randomId: botRandomId,
      senderId: BOT_SENDER_ID,
      message: payload.text,
      messageType: 'card',
      role: 'bot',
      senderFirstName: 'Support',
      senderLastName: 'Bot',
      metadata: {
        quickReplies: payload.quickReplies || [],
        orderRef: payload.orderRef || null,
        isBotResponse: true,
        escalate: payload.escalate || false,
      },
      currentDate: new Date().toISOString(),
    });
  }

  return message;
};

const handleMessage = async ({ roomId, userId, message, supportType }) => {
  console.log('[BOT-DBG] handleMessage | roomId=%s message="%s" supportType=%s', roomId, message, supportType);
  const room = await SupportChatRoom.findById(roomId).lean();

  const intent = classifyIntent(message);
  console.log('[BOT-DBG] intent=%s', intent);

  if (intent === 'escalate' || !intent) {
    const escalatePayload = {
      text:
        intent === 'escalate'
          ? "Sure — I've connected you to a support agent who will help shortly."
          : "I'm not sure about that one. Let me connect you to a support agent.",
      quickReplies: [],
      escalate: true,
    };
    await writeBotReply(roomId, escalatePayload);
    if (room) {
      await SupportChatRoom.findByIdAndUpdate(
        roomId,
        { escalated: true, escalatedIntent: intent || 'unknown' },
        { new: true }
      );
    }
    // Real-time handoff: as soon as the bot escalates, drain the queue to
    // assign chats one-by-one (serialised) instead of firing concurrent
    // autoAssignChat calls that can all pick the same agent (race condition).
    try {
      const drainResult = await supportAssignmentService.drainQueue({ limit: 10 });
      console.log('[BOT-DBG] drainQueue result:', JSON.stringify(drainResult));
    } catch (assignError) {
      // eslint-disable-next-line no-console
      console.error('support.bot drainQueue on escalate error:', assignError);
    }
    return { intent, escalated: true, roomId };
  }

  if (intent === 'start_over') {
    await writeBotReply(roomId, getMainMenu());
    return { intent, escalated: false };
  }

  let payload;
  switch (intent) {
    case 'order_status':
    case 'track_delivery':
      payload = await fetchOrderStatus(room);
      break;
    case 'refund_status':
      payload = await fetchRefundStatus(room);
      break;
    case 'dining_booking':
      payload = await fetchDiningBookingStatus(room);
      break;
    case 'tiffin_status':
      payload = await fetchTiffinStatus(room);
      break;
    case 'complaint_status':
      payload = await fetchComplaintStatus(room);
      break;
    case 'cancel_order':
      // For cancel, we escalate to human agent since actual cancellation requires verification
      payload = {
        text: "I understand you'd like to cancel. Let me connect you to a support agent who can help process your cancellation request.",
        quickReplies: [
          { label: 'Talk to an agent', action: 'escalate' },
          { label: 'Start over', action: 'start_over' },
        ],
        escalate: true,
      };
      break;
    default:
      payload = {
        text: "I'll have a support agent look into that for you.",
        quickReplies: getQuickRepliesForSupportType(supportType),
      };
  }

  await writeBotReply(roomId, payload);
  return { intent, escalated: false };
};

module.exports = {
  INTENTS,
  classifyIntent,
  getMainMenu,
  getQuickRepliesForSupportType,
  fetchOrderStatus,
  fetchRefundStatus,
  fetchDiningBookingStatus,
  fetchTiffinStatus,
  fetchComplaintStatus,
  writeBotReply,
  handleMessage,
};
