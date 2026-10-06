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
const { toJSON, paginate } = require('./plugins');

const supportChatRoomSchema = mongoose.Schema(
  {
    userId: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'User',
      required: true,
    },
    supportTeam: [
      {
        type: mongoose.SchemaTypes.ObjectId,
        ref: 'User',
        required: true,
      },
    ],
    orders: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'Orders',
      required: false,
    },
    booking: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'DiningBooking',
      required: false,
    },
    purchaseSubscription: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'UserPurchasedTiffinSubscription',
      required: false,
    },
    complaints: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'Complaints',
      required: false,
    },
    reportIssue: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'ReportIssueRestaurant',
      required: false,
    },
    restaurantComplaints: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'RestaurantComplaints',
      required: false,
    },
    supportType: {
      type: String,
      required: true,
      default: 'orders', // orders, dining, tiffin_subscription, complaints, reports,restaurant_complaints
    },
    lastMessage: {
      type: String,
      required: false,
    },
    lastMessageType: {
      type: String,
      required: false,
    },
    resolvedBy: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'User',
      required: false,
    },
    assignedTo: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'User',
      required: false,
    },
    assignedAt: {
      type: Date,
      required: false,
    },
    priority: {
      type: String,
      enum: ['normal', 'high', 'urgent'],
      default: 'normal',
      required: false,
    },
    dueAt: {
      type: Date,
      required: false,
    },
    escalated: {
      type: Boolean,
      default: false,
    },
    escalatedIntent: {
      type: String,
      required: false,
    },
    status: {
      type: String,
      default: 'open', // open, in_progress, resolved
    },
    csatRating: {
      type: Number,
      min: 1,
      max: 5,
      required: false,
    },
    csatFeedback: {
      type: String,
      required: false,
    },
    csatSubmittedAt: {
      type: Date,
      required: false,
    },
    resolvedAt: {
      type: Date,
      required: false,
    },
    firstHumanReplyAt: {
      type: Date,
      required: false,
    },
    firstAgentReplyAt: {
      type: Date,
      required: false,
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    snoozedUntil: {
      type: Date,
      required: false,
    },
    snoozedBy: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'User',
      required: false,
    },
    slaBreached: {
      type: Boolean,
      default: false,
    },
    slaTargetMinutes: {
      type: Number,
      required: false,
    },
  },
  {
    timestamps: true,
    toJSON: { getters: true },
  }
);

// add plugin that converts mongoose to json & convert to unique slug
supportChatRoomSchema.plugin(toJSON);
supportChatRoomSchema.plugin(paginate);

/**
 * @typedef SupportChatRoom
 */
const SupportChatRoom = mongoose.model('SupportChatRoom', supportChatRoomSchema);

module.exports = SupportChatRoom;

