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

const headerConfigSchema = mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    subtitle: {
      type: String,
      required: false,
      trim: true,
      default: '',
    },
    enabled: {
      type: Boolean,
      default: true,
    },
    animationType: {
      type: String,
      enum: ['lottie', 'image', 'video', 'none'],
      default: 'lottie',
    },
    animationUrl: {
      type: String,
      required: false,
      default: '',
    },
    animationPosition: {
      type: String,
      enum: ['left', 'right', 'center', 'background'],
      default: 'right',
    },
    hPosition: {
      type: String,
      enum: ['left', 'center', 'right'],
      default: 'right',
    },
    vPosition: {
      type: String,
      enum: ['top', 'center', 'bottom'],
      default: 'center',
    },
    fitToHeader: {
      type: Boolean,
      default: false,
    },
    animationSize: {
      type: Number,
      default: 60,
      min: 10,
      max: 100,
    },
    animationSpeed: {
      type: Number,
      default: 1.0,
      min: 0.5,
      max: 2,
    },
    animationRepeat: {
      type: Boolean,
      default: true,
    },
    animationLoop: {
      type: Boolean,
      default: true,
    },
    animationVerticalOffset: {
      type: Number,
      default: 0,
    },
    animationOffsetX: {
      type: Number,
      default: 0,
    },
    animationMode: {
      type: String,
      enum: ['single', 'multi', 'slides'],
      default: 'single',
    },
    animations: {
      type: [{
        type: { type: String, enum: ['lottie', 'image', 'none'], default: 'none' },
        url: { type: String, default: '' },
        hPosition: { type: String, enum: ['left', 'center', 'right'], default: 'right' },
        vPosition: { type: String, enum: ['top', 'center', 'bottom'], default: 'center' },
        fitToHeader: { type: Boolean, default: false },
        size: { type: Number, default: 60, min: 10, max: 100 },
        offsetX: { type: Number, default: 0 },
        offsetY: { type: Number, default: 0 },
        opacity: { type: Number, default: 100, min: 10, max: 100 },
      }],
      default: [],
    },
    slides: {
      type: [{
        animationType: { type: String, enum: ['lottie', 'image', 'none'], default: 'none' },
        animationUrl: { type: String, default: '' },
        animationPosition: { type: String, enum: ['left', 'right', 'center', 'background'], default: 'right' },
        hPosition: { type: String, enum: ['left', 'center', 'right'], default: 'right' },
        vPosition: { type: String, enum: ['top', 'center', 'bottom'], default: 'center' },
        animationSize: { type: Number, default: 60 },
        fitToHeader: { type: Boolean, default: false },
        animationOffsetX: { type: Number, default: 0 },
        animationVerticalOffset: { type: Number, default: 0 },
        title: { type: String, default: '' },
        subtitle: { type: String, default: '' },
        textColor: { type: String, default: '#FFFFFF' },
        ctaText: { type: String, default: '' },
        ctaType: { type: String, enum: ['restaurant', 'food', 'category', 'external', 'none'], default: 'none' },
        ctaTarget: { type: String, default: '' },
        ctaStyle: { type: String, enum: ['filled', 'outlined', 'pill'], default: 'filled' },
        ctaColor: { type: String, default: '#FFD600' },
        ctaTextColor: { type: String, default: '#FFFFFF' },
        ctaVisible: { type: Boolean, default: true },
      }],
      default: [],
    },
    ctaText: {
      type: String,
      required: false,
      default: '',
    },
    ctaType: {
      type: String,
      enum: ['restaurant', 'food', 'category', 'external', 'none'],
      default: 'none',
    },
    ctaTarget: {
      type: String,
      required: false,
      default: '',
    },
    ctaStyle: {
      type: String,
      enum: ['filled', 'outlined', 'pill'],
      default: 'filled',
    },
    ctaColor: {
      type: String,
      default: '#FFD600',
    },
    ctaTextColor: {
      type: String,
      default: '#FFFFFF',
    },
    ctaPosition: {
      type: String,
      enum: ['left', 'right', 'belowText'],
      default: 'belowText',
    },
    ctaVisible: {
      type: Boolean,
      default: true,
    },
    background: {
      type: String,
      default: '#568203',
    },
    showTitle: {
      type: Boolean,
      default: true,
    },
    backgroundGradient: {
      start: {
        type: String,
        default: '',
      },
      end: {
        type: String,
        default: '',
      },
      angle: {
        type: Number,
        default: 180,
      },
    },
    textColor: {
      type: String,
      default: '#FFFFFF',
    },
    textAlignment: {
      type: String,
      enum: ['left', 'center', 'right'],
      default: 'left',
    },
    contentPosition: {
      type: String,
      enum: ['top', 'middle', 'bottom'],
      default: 'middle',
    },
    expandedHeight: {
      type: Number,
      default: 220,
    },
    collapsedHeight: {
      type: Number,
      default: 110,
    },
    collapseBehavior: {
      type: String,
      enum: ['onScroll', 'alwaysExpanded', 'neverCollapse'],
      default: 'onScroll',
    },
    cornerRadius: {
      type: Number,
      default: 0,
    },
    startDate: {
      type: Date,
      required: false,
      default: null,
    },
    endDate: {
      type: Date,
      required: false,
      default: null,
    },
    priority: {
      type: Number,
      default: 1,
    },
    city: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'City',
      required: false,
      default: null,
    },
    translations: {
      type: Array,
      default: [],
    },
    schemaVersion: {
      type: Number,
      default: 1,
    },
    // PHASE 6 — device-class variant. When a client requests a specific variant
    // (mobile/desktop), the resolver prefers variant-specific configs over the
    // default 'all' config, enabling different hero content per device class.
    variant: {
      type: String,
      enum: ['all', 'mobile', 'desktop'],
      default: 'all',
    },
    // PHASE 4 — optional per-campaign intra-day delivery schedule window.
    // When enabled, the header only shows while "now" is within
    // [startTime, endTime] in the campaign timezone. enabled:false => always on.
    deliverySchedule: {
      enabled: { type: Boolean, default: false },
      startTime: { type: String, default: '00:00' },
      endTime: { type: String, default: '23:59' },
      timezone: { type: String, default: null },
    },
    lottieMeta: {
      composition: {
        width: { type: Number, default: 0 },
        height: { type: Number, default: 0 },
        aspect: { type: Number, default: 1 },
      },
      artworkBounds: {
        left: { type: Number, default: 0 },
        top: { type: Number, default: 0 },
        right: { type: Number, default: 0 },
        bottom: { type: Number, default: 0 },
      },
      computedAt: { type: Date, default: null },
    },
blurHash: {
      type: String,
      default: '',
    },
audit: {
      type: [
        {
          user: { type: String, default: '' },
          action: { type: String, enum: ['create', 'update', 'publish', 'rollback'], default: 'update' },
          timestamp: { type: Date, default: Date.now },
          changes: { type: Object, default: {} },
        },
      ],
      default: [],
    },
    status: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// add plugin that converts mongoose to json & convert to unique slug
headerConfigSchema.plugin(toJSON);
headerConfigSchema.plugin(paginate);

/**
 * @typedef HeaderConfig
 */
const HeaderConfig = mongoose.model('HeaderConfig', headerConfigSchema);

module.exports = HeaderConfig;