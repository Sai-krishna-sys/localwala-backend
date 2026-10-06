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
const {
  languageService,
  businessSettingsService,
  userSettingService,
  driverSettingsService,
  socialSigninService,
  waiterSettingService,
  visitorService,
  restaurantSettingsService,
  appWebSettingService,
  headerConfigService,
  kitchenOwnerSettingService,
  mediaStorageSettingService,
} = require('../services');

// Proxy media in-memory cache: key -> { buffer, expiresAt, contentType }
const _proxyMediaCache = new Map();
const PROXY_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
function getProxyCache(key) {
  const e = _proxyMediaCache.get(key);
  if (!e) return null;
  if (e.expiresAt < Date.now()) { _proxyMediaCache.delete(key); return null; }
  return e;
}
function setProxyCache(key, buffer, contentType) {
  _proxyMediaCache.set(key, { buffer, contentType, expiresAt: Date.now() + PROXY_CACHE_TTL_MS });
  if (_proxyMediaCache.size > 100) {
    const first = _proxyMediaCache.keys().next().value;
    _proxyMediaCache.delete(first);
  }
}

const getDefaultSettings = catchAsync(async (req, res) => {
  const { agent, userTrackingId } = req.body;
  const ip = req.connection.remoteAddress;
  let tracking;
  if (userTrackingId === null || userTrackingId === '') {
    const visitorTrackingParam = {
      ipAddress: ip,
      userAgent: agent,
    };
    tracking = await visitorService.saveVisitor(visitorTrackingParam);
  } else {
    const visitorTrackingParam = {
      ipAddress: ip,
      userAgent: agent,
    };
    tracking = await visitorService.getTrackingId(visitorTrackingParam);
  }
  const languages = await languageService.getPublicLanguages();
  const businessSettings = await businessSettingsService.getPublicBusinessSettings();
  const language = await languageService.getDefaultLanguage();
  const userSettings = await userSettingService.getUserSettingsPublic();
  const socialSignin = await socialSigninService.publicSocialSignin();
  const driverSettings = await driverSettingsService.driverSelfRegistration();
  const vendorSettings = await restaurantSettingsService.vendorSelfRegistration();
  const selfRegisterStatus = {
    driver: !!(
      driverSettings &&
      driverSettings !== null &&
      driverSettings.selfRegistration === true
    ),
    vendor: !!(
      vendorSettings &&
      vendorSettings !== null &&
      vendorSettings.selfRegistration === true
    ),
  };
  const appVersion = await appWebSettingService.userAppVersionDetail();
  const imagePath = await mediaStorageSettingService.getFilePathUrl();
  res.send({
    locales: languages,
    settings: businessSettings,
    defaultLocale: language,
    user: userSettings,
    social: socialSignin,
    selfRegister: selfRegisterStatus,
    versions: appVersion,
    tracking,
    imagePath,
  });
});

const getDefaultWebSettings = catchAsync(async (req, res) => {
  const languages = await languageService.getPublicLanguages();
  const businessSettings = await businessSettingsService.getPublicBusinessSettings();
  const language = await languageService.getDefaultLanguage();
  const userSettings = await userSettingService.getUserSettingsPublic();
  const driverSettings = await driverSettingsService.driverSelfRegistration();
  const vendorSettings = await restaurantSettingsService.vendorSelfRegistration();
  const selfRegisterStatus = {
    driver: !!(
      driverSettings &&
      driverSettings !== null &&
      driverSettings.selfRegistration === true
    ),
    vendor: !!(
      vendorSettings &&
      vendorSettings !== null &&
      vendorSettings.selfRegistration === true
    ),
  };
  const vendor = await restaurantSettingsService.getVendorSettings();
  const imagePath = await mediaStorageSettingService.getFilePathUrl();
  res.send({
    locales: languages,
    settings: businessSettings,
    defaultLocale: language,
    user: userSettings,
    selfRegister: selfRegisterStatus,
    vendor,
    imagePath,
  });
});

const getDriverDefaultSettings = catchAsync(async (req, res) => {
  const languages = await languageService.getPublicLanguages();
  const businessSettings = await businessSettingsService.getPublicBusinessSettings();
  const language = await languageService.getDefaultLanguage();
  const driverSettings = await driverSettingsService.driverPublicSettings();
  const socialSignin = await socialSigninService.publicSocialSignin();
  const appVersion = await appWebSettingService.deliverymanAppVersionDetail();
  const imagePath = await mediaStorageSettingService.getFilePathUrl();
  res.send({
    locales: languages,
    settings: businessSettings,
    defaultLocale: language,
    driver: driverSettings,
    social: socialSignin,
    versions: appVersion,
    imagePath,
  });
});

const getWaiterDefaultSettings = catchAsync(async (req, res) => {
  const languages = await languageService.getPublicLanguages();
  const businessSettings = await businessSettingsService.getPublicBusinessSettings();
  const language = await languageService.getDefaultLanguage();
  const waiterSettings = await waiterSettingService.getSettings();
  const socialSignin = await socialSigninService.publicSocialSignin();
  const appVersion = await appWebSettingService.waiterAppVersionDetail();
  const imagePath = await mediaStorageSettingService.getFilePathUrl();
  res.send({
    locales: languages,
    settings: businessSettings,
    defaultLocale: language,
    waiter: waiterSettings,
    social: socialSignin,
    versions: appVersion,
    imagePath,
  });
});

const getKitchenDefaultSettings = catchAsync(async (req, res) => {
  const languages = await languageService.getPublicLanguages();
  const businessSettings = await businessSettingsService.getPublicBusinessSettings();
  const language = await languageService.getDefaultLanguage();
  const kitchenSettings = await kitchenOwnerSettingService.getSettings();
  const socialSignin = await socialSigninService.publicSocialSignin();
  const appVersion = await appWebSettingService.kitchenAppVersionDetail();
  const imagePath = await mediaStorageSettingService.getFilePathUrl();
  res.send({
    locales: languages,
    settings: businessSettings,
    defaultLocale: language,
    kitchen: kitchenSettings,
    social: socialSignin,
    versions: appVersion,
    imagePath,
  });
});

const publicHeaderContent = catchAsync(async (req, res) => {
  const languages = await languageService.getPublicLanguages();
  res.send({ languages, success: true });
});

const getDynamicHeader = catchAsync(async (req, res) => {
  const { cityId, schemaVersion, variant } = req.query;
  const appWebSetting = await appWebSettingService.getAppWebSetting();
  const dynamicHeaderEnabled = !!(appWebSetting && appWebSetting.dynamicHeaderEnabled === true);
  let header = null;
  if (dynamicHeaderEnabled) {
    const active = await headerConfigService.getActiveHeaderConfig(cityId, undefined, variant || 'all');
    // PHASE 1 — v2 intent resolver (additive / backward-compatible).
    // Only when a client explicitly requests schemaVersion=2 do we return the
    // canonical intent shape. Otherwise the legacy flat payload is unchanged,
    // so existing clients keep working.
    header = String(schemaVersion) === '2' ? headerConfigService.resolveHeaderIntentV2(active) : active;
  }
  // Enterprise ETag + Cache-Control
  const crypto = require('crypto');
  const etagBase = header ? `${header.id || header._id || 'none'}-${header.version || 0}-${header.updatedAt || ''}` : `disabled-${dynamicHeaderEnabled}`;
  const etag = '"' + crypto.createHash('md5').update(etagBase).digest('hex') + '"';
  res.set('ETag', etag);
  res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');
  if (req.headers['if-none-match'] === etag) {
    return res.status(304).end();
  }
  res.send({
    dynamicHeaderEnabled,
    header,
    schemaVersion: String(schemaVersion) === '2' ? 2 : 1,
    success: true,
  });
});

const proxyMedia = catchAsync(async (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).send({ success: false, message: 'url query param required' });
  }

  // Serve from in-memory cache first (avoids S3 hit)
  const cacheKey = `proxy:${url}`;
  const cachedProxy = getProxyCache(cacheKey);
  if (cachedProxy) {
    res.writeHead(200, { 'Content-Type': cachedProxy.contentType || 'application/json', 'Cache-Control': 'public, max-age=86400' });
    return res.end(cachedProxy.buffer);
  }

  // Strip leading slashes — the key stored in DB is like "images/xxx.json"
  const fileKey = url.replace(/^\/+/, '');

  const mediaSetting = await mediaStorageSettingService.getMediaStorageSetting();
  if (!mediaSetting || !mediaSetting.credentials) {
    return res.status(500).send({ success: false, message: 'No storage configured', storageType: mediaSetting?.name || 'none' });
  }

  const { name: storageType, credentials } = mediaSetting;
  console.log('[proxyMedia] storageType:', storageType, 'fileKey:', fileKey);

  if (storageType === 'aws_s3') {
    const { S3Client, GetObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
    const s3 = new S3Client({
      region: credentials.awsRegionName,
      credentials: {
        accessKeyId: credentials.awsAccessKey,
        secretAccessKey: credentials.awsSecretKey,
      },
    });

    const tryFetch = async (key) => {
      const command = new GetObjectCommand({ Bucket: credentials.awsBucketName, Key: key });
      return s3.send(command);
    };

    // Try original key, then with .json, then without extension
    const candidates = [fileKey];
    if (!fileKey.endsWith('.json')) candidates.push(fileKey + '.json');
    if (fileKey.endsWith('.json')) candidates.push(fileKey.replace(/\.json$/, ''));
    // Also try without the "images/" prefix in case it was stored differently
    const bare = fileKey.replace(/^images\//, '');
    if (!candidates.includes(bare)) candidates.push(bare);
    if (!candidates.includes(bare + '.json')) candidates.push(bare + '.json');

    let lastErr;
    for (const key of candidates) {
      try {
        const response = await tryFetch(key);
        // Buffer + cache (so next hit skips S3)
        const bodyBuf = Buffer.from(await response.Body.transformToString());
        setProxyCache(cacheKey, bodyBuf, 'application/json');
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=86400',
        });
        return res.end(bodyBuf);
      } catch (err) {
        lastErr = err;
      }
    }
    return res.status(404).send({ success: false, message: 'File not found. Tried: ' + candidates.join(', ') });
  } else if (storageType === 'gcs') {
    const { Storage } = require('@google-cloud/storage');
    const gcsPath = require('path');
    const gcs = new Storage({
      projectId: credentials.gcsProjectId,
      keyFilename: gcsPath.join(__dirname, '../fcm_keys/serviceAccountKey.json'),
    });
    const candidates = [fileKey];
    if (!fileKey.endsWith('.json')) candidates.push(fileKey + '.json');
    for (const key of candidates) {
      try {
        const [buffer] = await gcs.bucket(credentials.gcsBucketName).file(key).download();
        setProxyCache(cacheKey, buffer, 'application/json');
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=86400' });
        return res.end(buffer);
      } catch (err) { /* try next */ }
    }
    return res.status(404).send({ success: false, message: 'File not found (GCS): ' + fileKey });
  } else if (storageType === 'azure') {
    const { BlobServiceClient } = require('@azure/storage-blob');
    const blobServiceClient = BlobServiceClient.fromConnectionString(credentials.azureConnectionString);
    const blockBlobClient = blobServiceClient.getContainerClient(credentials.azureContainerName).getBlockBlobClient(fileKey);
    try {
      const downloadResponse = await blockBlobClient.download(0);
      const chunks = [];
      for await (const chunk of downloadResponse.readableStreamBody) chunks.push(chunk);
      const azureBuf = Buffer.concat(chunks);
      setProxyCache(cacheKey, azureBuf, downloadResponse.contentType || 'application/json');
      res.writeHead(200, { 'Content-Type': downloadResponse.contentType || 'application/json', 'Cache-Control': 'public, max-age=86400' });
      return res.end(azureBuf);
    } catch (err) {
      return res.status(404).send({ success: false, message: 'File not found (Azure): ' + fileKey });
    }
  } else {
    const fs = require('fs');
    const filePath = require('path').join(__dirname, '../../public', fileKey);
    if (!fs.existsSync(filePath)) {
      return res.status(404).send({ success: false, message: 'File not found locally: ' + fileKey });
    }
    res.sendFile(filePath);
  }
});

module.exports = {
  getDefaultSettings,
  getDefaultWebSettings,
  getDriverDefaultSettings,
  getWaiterDefaultSettings,
  getKitchenDefaultSettings,
  publicHeaderContent,
  getDynamicHeader,
  proxyMedia,
};

