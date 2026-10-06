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
 * Canned responses (spec 18.4, 18.5).
 * NOTE: canned responses and the bot FAQ share ONE knowledge base — both read
 * this same CannedResponse collection. Admin edits here update both the agent
 * picker and the bot's FAQ answers.
 */

const { CannedResponse } = require('../models');

const createCannedResponse = async (body) => {
  return CannedResponse.create(body);
};

const listCannedResponses = async (options = {}) => {
  const limit =
    options.limit && parseInt(options.limit, 10) > 0 ? parseInt(options.limit, 10) : 10;
  const page = options.page && parseInt(options.page, 10) > 0 ? parseInt(options.page, 10) : 1;
  const skip = (page - 1) * limit;
  const query = options.isActive !== undefined ? { isActive: options.isActive === 'true' } : {};
  const results = await CannedResponse.find(query)
    .sort({ order: 1, createdAt: -1 })
    .skip(skip)
    .limit(limit);
  const totalResults = await CannedResponse.countDocuments(query);
  const totalPages = Math.ceil(totalResults / limit);
  return { results, page, limit, totalPages, totalResults, success: true };
};

const getCannedResponseById = async (id) => {
  return CannedResponse.findById(id);
};

const updateCannedResponse = async (id, body) => {
  return CannedResponse.findByIdAndUpdate(id, body, { new: true });
};

const deleteCannedResponse = async (id) => {
  return CannedResponse.findByIdAndDelete(id);
};

module.exports = {
  createCannedResponse,
  listCannedResponses,
  getCannedResponseById,
  updateCannedResponse,
  deleteCannedResponse,
};
