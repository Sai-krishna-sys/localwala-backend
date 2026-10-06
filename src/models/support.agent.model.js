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
const { toJSON } = require('./plugins');

const supportAgentSchema = mongoose.Schema(
  {
    user: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    acceptingChats: {
      type: Boolean,
      default: true,
    },
    maxConcurrentChats: {
      type: Number,
      required: true,
      default: 5,
      min: 0,
    },
    isBlocked: {
      type: Boolean,
      default: false,
    },
    isDeactivated: {
      type: Boolean,
      default: false,
    },
    lastOnlineAt: {
      type: Date,
      required: false,
    },
    lastAssignedAt: {
      type: Date,
      required: false,
    },
    isManager: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: { getters: true },
  }
);

supportAgentSchema.plugin(toJSON);

/**
 * @typedef SupportAgent
 */
const SupportAgent = mongoose.model('SupportAgent', supportAgentSchema);

module.exports = SupportAgent;
