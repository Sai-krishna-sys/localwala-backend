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
const { cannedResponseService } = require('../services');
const ApiError = require('../utils/ApiError');

const createCannedResponse = catchAsync(async (req, res) => {
  const { category, title, body, tags, isActive, order } = req.body;
  if (!title || !body) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'title and body are required');
  }
  const result = await cannedResponseService.createCannedResponse({
    category,
    title,
    body,
    tags,
    isActive,
    order,
  });
  res.status(httpStatus.CREATED).send(result);
});

const listCannedResponses = catchAsync(async (req, res) => {
  const options = pick(req.query, ['limit', 'page', 'isActive']);
  const result = await cannedResponseService.listCannedResponses(options);
  res.send(result);
});

const getCannedResponse = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await cannedResponseService.getCannedResponseById(id);
  if (!result) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Canned response not found');
  }
  res.send(result);
});

const updateCannedResponse = catchAsync(async (req, res) => {
  const { id } = req.params;
  const updateBody = pick(req.body, ['category', 'title', 'body', 'tags', 'isActive', 'order']);
  const result = await cannedResponseService.updateCannedResponse(id, updateBody);
  if (!result) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Canned response not found');
  }
  res.send(result);
});

const deleteCannedResponse = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await cannedResponseService.deleteCannedResponse(id);
  if (!result) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Canned response not found');
  }
  res.status(httpStatus.NO_CONTENT).send();
});

module.exports = {
  createCannedResponse,
  listCannedResponses,
  getCannedResponse,
  updateCannedResponse,
  deleteCannedResponse,
};
