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

const hexColor = Joi.string()
  .pattern(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/)
  .allow('');

const createHeaderConfig = {
  body: Joi.object().keys({
    title: Joi.string().required(),
    subtitle: Joi.string().allow(null, ""),
    enabled: Joi.boolean().allow(),
    animationType: Joi.string().valid('lottie', 'image', 'video', 'none').allow(null, ""),
    animationUrl: Joi.string().allow(null, ""),
    animationPosition: Joi.string().valid('left', 'right', 'center', 'background').allow(null, ""),
    hPosition: Joi.string().valid('left', 'center', 'right').allow(null, ""),
    vPosition: Joi.string().valid('top', 'center', 'bottom').allow(null, ""),
    fitToHeader: Joi.boolean().allow(null),
    animationSize: Joi.number().min(10).max(100).allow(null),
    animationSpeed: Joi.number().min(0.5).max(2).allow(null),
    animationRepeat: Joi.boolean().allow(),
    animationLoop: Joi.boolean().allow(),
    animationVerticalOffset: Joi.number().allow(null),
    animationOffsetX: Joi.number().allow(null),
    animationMode: Joi.string().valid('single', 'multi', 'slides').allow(null, ""),
    animations: Joi.array().items(Joi.object().keys({
      type: Joi.string().valid('lottie', 'image', 'none').allow(null, ""),
      url: Joi.string().allow(null, ""),
      hPosition: Joi.string().valid('left', 'center', 'right').allow(null, ""),
      vPosition: Joi.string().valid('top', 'center', 'bottom').allow(null, ""),
      size: Joi.number().min(10).max(100).allow(null),
      fitToHeader: Joi.boolean().allow(null),
      offsetX: Joi.number().allow(null),
      offsetY: Joi.number().allow(null),
      opacity: Joi.number().min(10).max(100).allow(null),
    })).allow(null),
    slides: Joi.array().items(Joi.object().keys({
      animationType: Joi.string().valid('lottie', 'image', 'none').allow(null, ""),
      animationUrl: Joi.string().allow(null, ""),
    animationPosition: Joi.string().valid('left', 'right', 'center', 'background').allow(null, ""),
    hPosition: Joi.string().valid('left', 'center', 'right').allow(null, ""),
    vPosition: Joi.string().valid('top', 'center', 'bottom').allow(null, ""),
      hPosition: Joi.string().valid('left', 'center', 'right').allow(null, ""),
      vPosition: Joi.string().valid('top', 'center', 'bottom').allow(null, ""),
    animationSize: Joi.number().min(10).max(100).allow(null),
    fitToHeader: Joi.boolean().allow(null),
      animationOffsetX: Joi.number().allow(null),
      animationVerticalOffset: Joi.number().allow(null),
      title: Joi.string().allow(null, ""),
      subtitle: Joi.string().allow(null, ""),
      textColor: hexColor,
      ctaText: Joi.string().allow(null, ""),
      ctaType: Joi.string().valid('restaurant', 'food', 'category', 'external', 'none').allow(null, ""),
      ctaTarget: Joi.string().allow(null, ""),
      ctaStyle: Joi.string().valid('filled', 'outlined', 'pill').allow(null, ""),
      ctaColor: hexColor,
      ctaTextColor: hexColor,
      ctaVisible: Joi.boolean().allow(),
    })).allow(null),
    ctaText: Joi.string().allow(null, ""),
    ctaType: Joi.string().valid('restaurant', 'food', 'category', 'external', 'none').allow(null, ""),
    ctaTarget: Joi.string().allow(null, ""),
    ctaStyle: Joi.string().valid('filled', 'outlined', 'pill').allow(null, ""),
    ctaColor: hexColor,
    ctaTextColor: hexColor,
    ctaPosition: Joi.string().valid('left', 'right', 'belowText').allow(null, ""),
    ctaVisible: Joi.boolean().allow(),
    background: hexColor,
    showTitle: Joi.boolean().allow(null),
    backgroundGradient: Joi.object()
      .keys({
        start: hexColor,
        end: hexColor,
        angle: Joi.number().allow(null),
      })
      .allow(null),
    textColor: hexColor,
    textAlignment: Joi.string().valid('left', 'center', 'right').allow(null, ""),
    contentPosition: Joi.string().valid('top', 'middle', 'bottom').allow(null, ""),
    expandedHeight: Joi.number().min(80).max(600).allow(null),
    renditions: Joi.array().items(Joi.object().keys({ url: Joi.string().allow(null, ""), width: Joi.number().allow(null), format: Joi.string().valid('webp','avif','jpeg','png').allow(null, "") })).allow(null),
    collapsedHeight: Joi.number().min(56).max(200).allow(null),
    collapseBehavior: Joi.string().valid('onScroll', 'alwaysExpanded', 'neverCollapse').allow(null, ""),
    cornerRadius: Joi.number().min(0).max(60).allow(null),
    variant: Joi.string().valid('all', 'mobile', 'desktop').allow(null, ""),
    deliverySchedule: Joi.object().keys({
      enabled: Joi.boolean().allow(null),
      startTime: Joi.string().allow(null, ""),
      endTime: Joi.string().allow(null, ""),
      timezone: Joi.string().allow(null, ""),
    }).allow(null),
    startDate: Joi.date().allow(null, ""),
    endDate: Joi.date().allow(null, ""),
    priority: Joi.number().integer().min(1).allow(null),
    city: Joi.string().custom(objectId).allow(null, ""),
    translations: Joi.allow(),
  }),
};

/**
 * Update uses the same body shape as create, but every field is optional
 * (partial update). This was previously missing — updates bypassed body
 * validation entirely. Shared shape kept in sync with createHeaderConfig.
 */
const updateBodySchema = Joi.object()
  .keys({
    title: Joi.string(),
    subtitle: Joi.string().allow(null, ""),
    enabled: Joi.boolean(),
    animationType: Joi.string().valid('lottie', 'image', 'video', 'none').allow(null, ""),
    animationUrl: Joi.string().allow(null, ""),
    hPosition: Joi.string().valid('left', 'center', 'right').allow(null, ""),
    vPosition: Joi.string().valid('top', 'center', 'bottom').allow(null, ""),
    fitToHeader: Joi.boolean().allow(null),
    animationSize: Joi.number().min(10).max(100).allow(null),
    animationRepeat: Joi.boolean(),
    animationLoop: Joi.boolean(),
    animationVerticalOffset: Joi.number().allow(null),
    animationOffsetX: Joi.number().allow(null),
    animationMode: Joi.string().valid('single', 'multi', 'slides').allow(null, ""),
    animations: Joi.array().items(Joi.object().keys({
      type: Joi.string().valid('lottie', 'image', 'none').allow(null, ""),
      url: Joi.string().allow(null, ""),
      hPosition: Joi.string().valid('left', 'center', 'right').allow(null, ""),
      vPosition: Joi.string().valid('top', 'center', 'bottom').allow(null, ""),
      size: Joi.number().min(10).max(100).allow(null),
      fitToHeader: Joi.boolean().allow(null),
      offsetX: Joi.number().allow(null),
      offsetY: Joi.number().allow(null),
      opacity: Joi.number().min(10).max(100).allow(null),
    })),
    slides: Joi.array().items(Joi.object().keys({
      animationType: Joi.string().valid('lottie', 'image', 'none').allow(null, ""),
      animationUrl: Joi.string().allow(null, ""),
      hPosition: Joi.string().valid('left', 'center', 'right').allow(null, ""),
      vPosition: Joi.string().valid('top', 'center', 'bottom').allow(null, ""),
      animationSize: Joi.number().min(10).max(100).allow(null),
      fitToHeader: Joi.boolean().allow(null),
      animationOffsetX: Joi.number().allow(null),
      animationVerticalOffset: Joi.number().allow(null),
      title: Joi.string().allow(null, ""),
      subtitle: Joi.string().allow(null, ""),
      textColor: hexColor,
      ctaText: Joi.string().allow(null, ""),
      ctaType: Joi.string().valid('restaurant', 'food', 'category', 'external', 'none').allow(null, ""),
      ctaTarget: Joi.string().allow(null, ""),
      ctaStyle: Joi.string().valid('filled', 'outlined', 'pill').allow(null, ""),
      ctaColor: hexColor,
      ctaTextColor: hexColor,
      ctaVisible: Joi.boolean(),
    })),
    ctaText: Joi.string().allow(null, ""),
    ctaType: Joi.string().valid('restaurant', 'food', 'category', 'external', 'none').allow(null, ""),
    ctaTarget: Joi.string().allow(null, ""),
    ctaStyle: Joi.string().valid('filled', 'outlined', 'pill').allow(null, ""),
    ctaColor: hexColor,
    ctaTextColor: hexColor,
    ctaPosition: Joi.string().valid('left', 'right', 'belowText').allow(null, ""),
    ctaVisible: Joi.boolean(),
    background: hexColor,
    showTitle: Joi.boolean().allow(null),
    backgroundGradient: Joi.object()
      .keys({
        start: hexColor,
        end: hexColor,
        angle: Joi.number().allow(null),
      })
      .allow(null),
    textColor: hexColor,
    textAlignment: Joi.string().valid('left', 'center', 'right').allow(null, ""),
    contentPosition: Joi.string().valid('top', 'middle', 'bottom').allow(null, ""),
    expandedHeight: Joi.number().min(80).max(600).allow(null),
    collapseBehavior: Joi.string().valid('onScroll', 'alwaysExpanded', 'neverCollapse').allow(null, ""),
    cornerRadius: Joi.number().min(0).max(60).allow(null),
    variant: Joi.string().valid('all', 'mobile', 'desktop').allow(null, ""),
    deliverySchedule: Joi.object().keys({
      enabled: Joi.boolean().allow(null),
      startTime: Joi.string().allow(null, ""),
      endTime: Joi.string().allow(null, ""),
      timezone: Joi.string().allow(null, ""),
    }).allow(null),
    startDate: Joi.date().allow(null, ""),
    endDate: Joi.date().allow(null, ""),
    priority: Joi.number().integer().min(1).allow(null),
    city: Joi.string().custom(objectId).allow(null, ""),
    translations: Joi.allow(),
  })
  .min(1)
  .unknown(true);

const updateHeaderConfig = {
  params: Joi.object().keys({
    headerId: Joi.string().custom(objectId).required(),
  }),
  body: updateBodySchema,
};

const allValidation = {
  query: Joi.object().keys({
    sortBy: Joi.string().allow(null, ""),
    limit: Joi.number().integer().allow(null, ""),
    page: Joi.number().integer().allow(null, ""),
    search: Joi.string().allow(null, ""),
  }),
};

const idValidation = {
  params: Joi.object().keys({
    headerId: Joi.string().custom(objectId).required(),
  }),
};

module.exports = {
  createHeaderConfig,
  updateHeaderConfig,
  allValidation,
  idValidation,
};
