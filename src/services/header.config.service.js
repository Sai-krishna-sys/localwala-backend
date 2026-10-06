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
const { status: httpStatus } = require('http-status');
const { HeaderConfig, Restaurant, Food, BusinessSettings } = require('../models');
const ApiError = require('../utils/ApiError');
const checkArrayNotEmpty = require('../utils/arrayNotEmpty');
const { attachLottieMetadata } = require('../utils/lottieMetadata');
// Generic app cache (Valkey/Redis with in-memory fallback) — same API as headerCache
const appCache = require('../utils/appCache');
const headerCache = appCache; // alias for header:active prefix (back-compat)

const headerConfigBody = (param) => ({
  title: param.title,
  subtitle: param.subtitle,
  enabled: param.enabled,
  animationMode: param.animationMode || 'single',
  animationType: param.animationType,
  animationUrl: param && param.animationUrl !== '' && param.animationUrl !== null ? param.animationUrl : '',
  animationPosition: param.animationPosition,
  hPosition: param.hPosition || 'right',
  vPosition: param.vPosition || 'center',
  fitToHeader: param.fitToHeader || false,
  animationSize: param.animationSize,
  animationSpeed: param.animationSpeed,
  animationLoop: param.animationLoop ?? param.animationRepeat ?? true,
  animationRepeat: param.animationRepeat ?? param.animationLoop ?? true,
  animationVerticalOffset: param.animationVerticalOffset,
  animationOffsetX: param.animationOffsetX,
  animations: param.animations || [],
  slides: param.slides || [],
  ctaText: param.ctaText,
  ctaType: param.ctaType,
  ctaTarget: param && param.ctaTarget !== '' && param.ctaTarget !== null ? param.ctaTarget : '',
  ctaStyle: param.ctaStyle,
  ctaColor: param.ctaColor,
  ctaTextColor: param.ctaTextColor,
  ctaPosition: param.ctaPosition,
  ctaVisible: param.ctaVisible,
  background: param.background,
  showTitle: param.showTitle !== false,
  backgroundGradient: param.backgroundGradient,
  textColor: param.textColor,
  textAlignment: param.textAlignment,
  contentPosition: param.contentPosition,
  expandedHeight: param.expandedHeight,
  collapsedHeight: param.collapsedHeight,
  collapseBehavior: param.collapseBehavior,
  cornerRadius: param.cornerRadius,
  variant: param.variant || 'all',
  startDate: param && param.startDate !== '' && param.startDate !== null ? param.startDate : null,
  endDate: param && param.endDate !== '' && param.endDate !== null ? param.endDate : null,
  priority: param.priority,
  city: param && param.city !== '' && param.city !== null ? param.city : null,
  translations: param.translations,
  blurHash: param.blurHash || '',
  deliverySchedule: {
    enabled: param.deliverySchedule && param.deliverySchedule.enabled === true,
    startTime: (param.deliverySchedule && param.deliverySchedule.startTime) || '00:00',
    endTime: (param.deliverySchedule && param.deliverySchedule.endTime) || '23:59',
    timezone: (param.deliverySchedule && param.deliverySchedule.timezone) || null,
  },
});

const createHeaderConfig = async (param) => {
  const body = headerConfigBody(param);
  body.version = 1;
  body.audit = [{ user: param._auditUser || 'admin', action: 'create', timestamp: new Date(), changes: { title: body.title } }];
  const headerData = new HeaderConfig(body);
  const created = await HeaderConfig.create(headerData);
  // Invalidate header cache — new campaign may be highest priority (Valkey + fallback)
  await appCache.clearByPrefix('header:active:');
  // PHASE 5 — best-effort Lottie metadata; non-fatal on failure.
  attachLottieMetadata(created);
  return { success: true };
};

const getAllHeaderConfig = async (options) => {
  const limit = options.limit && parseInt(options.limit, 10) > 0 ? parseInt(options.limit, 10) : 10;
  const page = options.page && parseInt(options.page, 10) > 0 ? parseInt(options.page, 10) : 1;
  const skip = (page - 1) * limit;
  const searchRegExp = RegExp(options.search, 'i');
  const matchQuery = {
    $or: [
      { title: searchRegExp },
      {
        translations: {
          $elemMatch: {
            value: { $regex: searchRegExp },
          },
        },
      },
    ],
  };
  const query = [
    { $match: matchQuery },
    { $sort: { priority: 1, createdAt: -1 } },
    { $skip: skip },
    { $limit: Number(limit) },
    {
      $lookup: {
        from: 'cities',
        localField: 'city',
        foreignField: '_id',
        as: 'cities',
      },
    },
    {
      $unwind: {
        path: '$cities',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $project: {
        _id: 0,
        id: '$_id',
        title: 1,
        subtitle: 1,
        enabled: 1,
        animationMode: 1,
        animationType: 1,
        animationUrl: 1,
        animationPosition: 1,
        hPosition: 1,
        vPosition: 1,
        animationSize: 1,
        fitToHeader: 1,
        animationSpeed: 1,
        animationRepeat: 1,
        animationLoop: 1,
        animationVerticalOffset: 1,
        animationOffsetX: 1,
        animations: 1,
        slides: 1,
        ctaText: 1,
        ctaType: 1,
        ctaTarget: 1,
        ctaStyle: 1,
        ctaColor: 1,
        ctaTextColor: 1,
        ctaPosition: 1,
        ctaVisible: 1,
        background: 1,
        backgroundGradient: 1,
        textColor: 1,
        textAlignment: 1,
        contentPosition: 1,
        expandedHeight: 1,
        collapsedHeight: 1,
        collapseBehavior: 1,
        cornerRadius: 1,
        startDate: 1,
        endDate: 1,
        priority: 1,
        status: 1,
        translations: 1,
        city: {
          id: { $ifNull: ['$cities._id', ''] },
          name: { $ifNull: ['$cities.name', ''] },
          translations: { $ifNull: ['$cities.translations', []] },
        },
      },
    },
  ];
  const results = await HeaderConfig.aggregate(query);
  const countResult = await HeaderConfig.aggregate([{ $match: matchQuery }, { $count: 'totalCount' }]);
  return Promise.all([results, countResult]).then(() => {
    const totalResults = checkArrayNotEmpty(countResult) ? countResult[0].totalCount : 0;
    const totalPages = Math.ceil(totalResults / limit);
    const result = {
      results,
      page,
      limit,
      totalPages,
      totalResults,
    };
    return Promise.resolve(result);
  });
};

const getHeaderConfigId = async (id) => {
  return HeaderConfig.findById(id);
};

const updateHeaderConfigById = async (headerId, param) => {
  const headerConfig = await getHeaderConfigId(headerId);
  if (!headerConfig) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Not found');
  }
  const body = headerConfigBody(param);
  // Enterprise version + audit
  body.version = (headerConfig.version || 1) + 1;
  const auditEntry = { user: param._auditUser || 'admin', action: 'update', timestamp: new Date(), changes: { title: body.title } };
  body.audit = [...(headerConfig.audit || []), auditEntry].slice(-20);
  Object.assign(headerConfig, body);
  await headerConfig.save();
  await appCache.clearByPrefix('header:active:');
  // PHASE 5 — best-effort Lottie metadata; non-fatal on failure.
  attachLottieMetadata(headerConfig);
  return { success: true };
};

const updateHeaderConfigStatus = async (headerId, param) => {
  const headerConfig = await getHeaderConfigId(headerId);
  if (!headerConfig) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Not found');
  }
  const updateBody = {
    status: param.status,
  };
  Object.assign(headerConfig, updateBody);
  await headerConfig.save();
  await appCache.clearByPrefix('header:active:');
  return { success: true };
};

const deleteHeaderConfigById = async (headerId) => {
  const headerConfig = await getHeaderConfigId(headerId);
  if (!headerConfig) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Not found');
  }
  await headerConfig.deleteOne();
  await appCache.clearByPrefix('header:active:');
  return { success: true };
};

const getHeaderConfigPreview = async (headerId) => {
  const headerConfig = await getHeaderConfigId(headerId);
  if (!headerConfig) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Not found');
  }
  return headerConfig;
};

const getHeaderV2Intent = async (headerId) => {
  const headerConfig = await getHeaderConfigId(headerId);
  if (!headerConfig) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Not found');
  }
  return resolveHeaderIntentV2(headerConfig);
};

/**
 * Public: pick the highest-priority active header campaign for a city.
 * Rules: status + enabled true, startDate <= now (or null),
 * endDate >= now (or null), city matches (or null = all cities).
 */
/**
 * PHASE 4 — pure intra-day delivery-schedule check.
 * A schedule is "open" when `enabled` is false/absent (always on), or when the
 * current HH:mm (in the campaign timezone, falling back to server tz, then UTC)
 * falls within [startTime, endTime]. Overnight windows (22:00–02:00) are handled.
 * Returns either a boolean (single window) — kept here for forward-compat.
 */
const parseHHMM = (value) => {
  if (typeof value !== 'string') return null;
  const m = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hours = parseInt(m[1], 10);
  const minutes = parseInt(m[2], 10);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
};

const toHHMM = (date, timezone) => {
  let str;
  try {
    str = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: timezone || undefined,
    }).format(date);
  } catch (_) {
    str = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
  }
  const m = str.match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
};

const isDeliveryScheduleOpen = (schedule, now = new Date(), timezone) => {
  if (!schedule || !schedule.enabled) return true;
  const start = parseHHMM(schedule.startTime);
  const end = parseHHMM(schedule.endTime);
  if (start == null || end == null) return true;
  const tz = schedule.timezone || timezone || undefined;
  const current = toHHMM(now, tz);
  if (current == null) return true;
  if (start <= end) {
    return current >= start && current <= end;
  }
  // Overnight window (e.g. 22:00–02:00): open past midnight until end.
  return current >= start || current <= end;
};

const getActiveHeaderConfig = async (cityId, timezone, variant) => {
  const cacheKey = `header:active:${cityId || 'all'}:${variant || 'all'}`;
  const cached = await appCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const now = new Date();
  // cityId="all" or invalid ObjectId → treat as no city filter (all cities)
  let cityMatch = {};
  if (cityId && cityId !== 'all' && mongoose.Types.ObjectId.isValid(cityId)) {
    cityMatch = {
      $or: [
        { city: null },
        { city: new mongoose.Types.ObjectId(cityId) },
      ],
    };
  }
  const query = [
    {
      $match: {
        status: true,
        enabled: true,
        $or: [{ startDate: null }, { startDate: { $lte: now } }],
        $and: [{ $or: [{ endDate: null }, { endDate: { $gte: now } }] }, cityMatch],
      },
    },
    { $sort: { priority: 1, createdAt: -1 } },
    { $limit: 10 },
  ];
  const results = await HeaderConfig.aggregate(query);

  // PHASE 4 — resolve the business timezone (schedule windows are evaluated in
  // the business/merchant zone, mirroring the app's open/close awareness).
  let resolvedTimezone = timezone;
  if (!resolvedTimezone) {
    try {
      const biz = await BusinessSettings.findOne({}, { timezone: 1 }).lean();
      const utc = biz && biz.timezone && biz.timezone.utc;
      if (Array.isArray(utc) && utc.length) resolvedTimezone = utc[0];
    } catch (_) { /* timezone lookup is best-effort */ }
  }

  // PHASE 6 — variant cascade. Filter by schedule first, then prefer the
  // requested variant over the default 'all' config. The cascade is:
  //   requested variant → 'all' → null.
  // This lets admins create device-specific hero content while keeping full
  // backward-compatibility for configs that don't set a variant.
  const scheduleOk = (results || []).filter((c) => isDeliveryScheduleOpen(c.deliverySchedule, now, resolvedTimezone));

  let active = null;
  if (variant && variant !== 'all') {
    active = scheduleOk.find((c) => c.variant === variant) || scheduleOk.find((c) => c.variant === 'all') || scheduleOk[0] || null;
  } else {
    active = scheduleOk[0] || null;
  }

  if (active && active.ctaType === 'restaurant' && active.ctaTarget) {
    const restaurant = await Restaurant.findById(active.ctaTarget, { name: 1, slug: 1 });
    active.ctaRestaurant = restaurant ? { id: restaurant.id, name: restaurant.name, slug: restaurant.slug } : null;
  }
  if (active && active.ctaType === 'food' && active.ctaTarget) {
    const food = await Food.findById(active.ctaTarget, { name: 1 });
    active.ctaFood = food ? { id: food.id, name: food.name } : null;
  }
  // Cache result (including null) for 5 minutes — Valkey shared, fallback Map per instance
  await appCache.set(cacheKey, active, 300000);
  return active;
};

/**
 * PHASE 1 — v2 INTENT RESOLVER (additive / backward-compatible).
 *
 * Maps the stored header config into the canonical "intent" shape agreed in the
 * enterprise architecture:
 *   Backend tells the app what the header intends to be (variant, policy,
 *   composition metadata). Flutter determines the final pixels (Phase 2).
 *
 * No pixel values are baked for a device width. `variant` is a label, not a set
 * of numbers. Legacy/dead fields (animationPosition, layout, placement,
 * collapsedHeight, animationSpeed) are intentionally OMITTED from the v2 shape
 * and do not influence it.
 *
 * The legacy flat response is unchanged; this resolver is only selected when a
 * client requests `?schemaVersion=2`.
 */
const mapPositionToHeroMode = (fitToHeader) => (fitToHeader ? 'fillHeader' : 'anchored');

const mapAnimationToIntent = (mode, firstSlide, animations) => {
  const sourceType = firstSlide && firstSlide.animationType ? firstSlide.animationType : 'none';
  const sourceUrl = firstSlide && firstSlide.animationUrl ? firstSlide.animationUrl : '';
  return {
    source: {
      type: sourceType,
      url: sourceUrl || null,
    },
    mode: mode || 'single',
    render: {
      fit: mapPositionToHeroMode(firstSlide && firstSlide.fitToHeader),
      loop: firstSlide && firstSlide.animationLoop != null ? firstSlide.animationLoop : true,
      autoplay: true,
    },
    blocks: Array.isArray(animations) && animations.length
      ? animations.map((a) => ({
          type: a.type || 'none',
          url: a.url || null,
          heroMode: mapPositionToHeroMode(a.fitToHeader),
          anchor: { h: a.hPosition || 'right', v: a.vPosition || 'center' },
          sizePercent: a.size != null ? a.size : 60,
          offsets: { x: a.offsetX != null ? a.offsetX : 0, y: a.offsetY != null ? a.offsetY : 0 },
          opacity: a.opacity != null ? a.opacity : 100,
        }))
      : [],
  };
};

const mapContentToIntent = (active) => {
  const background = active && active.backgroundGradient && active.backgroundGradient.start
    ? {
        type: 'gradient',
        start: active.backgroundGradient.start,
        end: active.backgroundGradient.end || '',
        angle: active.backgroundGradient.angle != null ? active.backgroundGradient.angle : 180,
      }
    : {
        type: 'solid',
        color: (active && active.background) || '#568203',
      };
  const textColor = (active && active.textColor) || '#FFFFFF';
  return {
    title: (active && active.title) || '',
    subtitle: (active && active.subtitle) || '',
    showTitle: active ? active.showTitle !== false : true,
    textColor,
    textAlignment: (active && active.textAlignment) || 'left',
    contentPosition: (active && active.contentPosition) === 'bottom' ? 'bottom' : (active && active.contentPosition) === 'top' ? 'top' : 'center',
    background,
  };
};

/**
 * PHASE 4 — canonical color palette engine.
 * Manual mode only: pass through the stored colors verbatim.
 */
const mapPaletteToIntent = (active) => {
  const background = active && active.backgroundGradient && active.backgroundGradient.start
    ? {
        type: 'gradient',
        start: active.backgroundGradient.start,
        end: active.backgroundGradient.end || '',
        angle: active.backgroundGradient.angle != null ? active.backgroundGradient.angle : 180,
      }
    : {
        type: 'solid',
        color: (active && active.background) || '#568203',
      };
  return {
    background,
    text: {
      primary: (active && active.textColor) || '#FFFFFF',
      secondary: (active && active.textColor) || '#FFFFFF',
    },
    cta: {
      fill: (active && active.ctaColor) || '#FFD600',
      label: (active && active.ctaTextColor) || '#FFFFFF',
    },
  };
};

/**
 * Resolve composition/artworkBounds.
 * When Lottie metadata is present on the doc (lottie_meta cached) use it;
 * otherwise emit a neutral default. This is a stub hook so the cached
 * metadata (Phase 1 Lottie-metadata work item) can slot in without changing
 * the contract.
 */
const resolveComposition = (active) => {
  const meta = active && active.lottieMeta && active.lottieMeta.composition;
  const composition = meta && meta.width && meta.height
    ? {
        width: meta.width,
        height: meta.height,
        aspect: meta.aspect || (meta.height > 0 ? meta.width / meta.height : 1),
      }
    : { width: 0, height: 0, aspect: 1 };
  const artwork = active && active.lottieMeta && active.lottieMeta.artworkBounds;
  const artworkBounds = artwork
    ? { left: artwork.left, top: artwork.top, right: artwork.right, bottom: artwork.bottom }
    : (composition.width > 0 ? { left: 0, top: 0, right: composition.width, bottom: composition.height } : null);
  return { composition, artworkBounds, textSafeArea: null };
};

const resolveHeaderIntentV2 = (active) => {
  if (!active) return null;
  const policy = {
    layout: (active.collapseBehavior || 'onScroll') === 'onScroll' ? 'pinned' : 'float',
    behavior: (active.collapseBehavior || 'onScroll') === 'onScroll' ? 'onScroll' : 'alwaysExpanded',
    heroMode: mapPositionToHeroMode(active.fitToHeader),
    anchor: {
      h: active.hPosition || 'right',
      v: active.vPosition || 'center',
    },
    offsets: {
      x: active.animationOffsetX != null ? active.animationOffsetX : 0,
      y: active.animationVerticalOffset != null ? active.animationVerticalOffset : 0,
    },
    cornerRadius: active.cornerRadius != null ? active.cornerRadius : 0,
  };
  const { composition, artworkBounds, textSafeArea } = resolveComposition(active);
  const content = mapContentToIntent(active);
  const palette = mapPaletteToIntent(active);
  const animation = mapAnimationToIntent(active.animationMode, active, active.animations);
  const cta = {
    type: active.ctaType || 'none',
    label: active.ctaText || '',
    target: active.ctaTarget || null,
    color: active.ctaColor || '#FFD600',
    textColor: active.ctaTextColor || '#FFFFFF',
    visible: active.ctaVisible != null ? active.ctaVisible : true,
    position: active.ctaPosition || 'belowText',
    style: active.ctaStyle || 'filled',
    restaurant: active.ctaRestaurant || null,
    food: active.ctaFood || null,
  };
  return {
    schemaVersion: 2,
    id: active.id || active._id,
    enabled: active.enabled != null ? active.enabled : true,
    variant: active.variant || ((active.collapseBehavior || 'onScroll') === 'onScroll' ? 'mobile' : 'desktop'),
    policy,
    composition,
    artworkBounds,
    textSafeArea,
    content,
    palette,
    animation,
    cta,
    slides: Array.isArray(active.slides) ? active.slides : [],
    deliverySchedule: {
      enabled: !!(active.deliverySchedule && active.deliverySchedule.enabled),
      startTime: (active.deliverySchedule && active.deliverySchedule.startTime) || '00:00',
      endTime: (active.deliverySchedule && active.deliverySchedule.endTime) || '23:59',
      timezone: (active.deliverySchedule && active.deliverySchedule.timezone) || null,
    },
  };
};

module.exports = {
  createHeaderConfig,
  getAllHeaderConfig,
  updateHeaderConfigById,
  updateHeaderConfigStatus,
  deleteHeaderConfigById,
  getHeaderConfigPreview,
  getHeaderV2Intent,
  getActiveHeaderConfig,
  isDeliveryScheduleOpen,
  resolveHeaderIntentV2,
};