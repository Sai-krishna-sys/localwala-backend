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

const checkChatRoomValidation = {
  body: Joi.object().keys({
    senderId: Joi.string().custom(objectId).required(),
    receiverId: Joi.string().custom(objectId).required(),
    limit: Joi.number().required(),
    page: Joi.number().required(),
  }),
};

const sendChatMessageValidation = {
  body: Joi.object().keys({
    room: Joi.string().custom(objectId).required(),
    sender: Joi.string().custom(objectId).required(),
    msg: Joi.string().required(),
    msgType: Joi.string().required().allow('text', 'img'),
  }),
};

const chatListValidation = {
  params: Joi.object().keys({
    user: Joi.string().custom(objectId),
  }),
};

const getChatConversionValidation = {
  body: Joi.object().keys({
    roomId: Joi.string().custom(objectId).required(),
    limit: Joi.number().required(),
    page: Joi.number().required(),
  }),
};

const supportChatValidation = {
  body: Joi.object().keys({
    roomId: Joi.string().custom(objectId).required(),
    supportTeam: Joi.string().custom(objectId).required(),
    limit: Joi.number().required(),
    page: Joi.number().required(),
  }),
};

const supportChatRoomValidation = {
  body: Joi.object().keys({
    user: Joi.string().custom(objectId).required(),
    type: Joi.string()
      .valid(
        'orders',
        'dining',
        'tiffin_subscription',
        'complaints',
        'reports',
        'restaurant_complaints'
      )
      .required(),
    typeId: Joi.string().custom(objectId).required(),
    limit: Joi.number().required(),
    page: Joi.number().required(),
  }),
};

const resolveSupportChatValidation = {
  body: Joi.object().keys({
    id: Joi.string().custom(objectId).required(),
    team: Joi.string().custom(objectId).required(),
  }),
};

const exportSupportChatValidation = {
  params: Joi.object().keys({
    id: Joi.string().custom(objectId).required(),
  }),
};

const supportTeamChatValidation = {
  params: Joi.object().keys({
    id: Joi.string().custom(objectId).required(),
  }),
};

const adminChatMessagesValidation = {
  params: Joi.object().keys({
    id: Joi.string().custom(objectId).required(),
  }),
  query: Joi.object().keys({
    limit: Joi.number().integer(),
    page: Joi.number().integer(),
  }),
};

const cityzenChatMessagesValidation = {
  params: Joi.object().keys({
    id: Joi.string().custom(objectId).required(),
  }),
  query: Joi.object().keys({
    limit: Joi.number().integer(),
    page: Joi.number().integer(),
  }),
};

module.exports = {
  checkChatRoomValidation,
  sendChatMessageValidation,
  chatListValidation,
  getChatConversionValidation,
  supportChatValidation,
  supportChatRoomValidation,
  resolveSupportChatValidation,
  exportSupportChatValidation,
  supportTeamChatValidation,
  adminChatMessagesValidation,
  cityzenChatMessagesValidation,
};

