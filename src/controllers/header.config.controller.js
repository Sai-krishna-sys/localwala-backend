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

const catchAsync = require('../utils/catchAsync');
const pick = require('../utils/pick');
const { headerConfigService } = require('../services');

const create = catchAsync(async (req, res) => {
  const result = await headerConfigService.createHeaderConfig(req.body);
  res.send(result);
});

const get = catchAsync(async (req, res) => {
  const options = pick(req.query, ['sortBy', 'limit', 'page', 'search']);
  const result = await headerConfigService.getAllHeaderConfig(options);
  res.send(result);
});

const update = catchAsync(async (req, res) => {
  const result = await headerConfigService.updateHeaderConfigById(req.params.headerId, req.body);
  res.send(result);
});

const updateStatus = catchAsync(async (req, res) => {
  const result = await headerConfigService.updateHeaderConfigStatus(req.params.headerId, req.body);
  res.send(result);
});

const drop = catchAsync(async (req, res) => {
  await headerConfigService.deleteHeaderConfigById(req.params.headerId);
  res.send({ success: true });
});

const preview = catchAsync(async (req, res) => {
  const result = await headerConfigService.getHeaderConfigPreview(req.params.headerId);
  res.send(result);
});

const v2Intent = catchAsync(async (req, res) => {
  const result = await headerConfigService.getHeaderV2Intent(req.params.headerId);
  res.send(result);
});

module.exports = {
  create,
  get,
  update,
  updateStatus,
  drop,
  preview,
  v2Intent,
};
