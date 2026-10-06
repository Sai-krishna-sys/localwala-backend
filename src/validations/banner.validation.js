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

const Joi = require('joi');
const { objectId } = require('./custom.validation');

const createBanner = {
  body: Joi.object().keys({
    title: Joi.string().required(),
    type: Joi.string().required().allow('restaurant', 'food', 'external'),
    city: Joi.string().custom(objectId).required(),
    restaurant: Joi.string().custom(objectId).allow(null, ''),
    food: Joi.string().custom(objectId).allow(null, ''),
    image: Joi.string().required(),
    external: Joi.string().allow(null, ''),
    translations: Joi.allow(),
  }),
};

const cityzenCreateBanner = {
  params: Joi.object().keys({
    master: Joi.string().custom(objectId).required(),
  }),
  body: Joi.object().keys({
    title: Joi.string().required(),
    type: Joi.string().required().allow('restaurant', 'food', 'external'),
    restaurant: Joi.string().custom(objectId).allow(null, ''),
    food: Joi.string().custom(objectId).allow(null, ''),
    image: Joi.string().required(),
    external: Joi.string().allow(null, ''),
    translations: Joi.allow(),
  }),
};

module.exports = {
  createBanner,
  cityzenCreateBanner,
};
