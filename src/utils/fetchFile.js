const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { Storage } = require('@google-cloud/storage');
const { BlobServiceClient } = require('@azure/storage-blob');
const fs = require('fs');
const path = require('path');

let _settingsCache = null;
let _settingsCacheTime = 0;
const CACHE_TTL = 300000;

// File content cache: key -> { text, expiresAt }  TTL 6h for Lottie/json
const _fileCache = new Map();
const FILE_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
function getFileCache(key) {
  const e = _fileCache.get(key);
  if (!e) return undefined;
  if (e.expiresAt < Date.now()) { _fileCache.delete(key); return undefined; }
  return e.text;
}
function setFileCache(key, text) {
  _fileCache.set(key, { text, expiresAt: Date.now() + FILE_CACHE_TTL_MS });
  // simple size cap 50 entries
  if (_fileCache.size > 50) {
    const firstKey = _fileCache.keys().next().value;
    _fileCache.delete(firstKey);
  }
}

const getStorageSettings = async () => {
  const now = Date.now();
  if (_settingsCache && (now - _settingsCacheTime) < CACHE_TTL) return _settingsCache;
  const MediaStorageSetting = (await require('../models')).MediaStorageSetting;
  _settingsCache = await MediaStorageSetting.findOne();
  _settingsCacheTime = now;
  return _settingsCache;
};

const fetchFileAsText = async (rawUrl) => {
  if (!rawUrl) return null;
  // Check file cache first ( rawUrl as key)
  const cachedFile = getFileCache(rawUrl);
  if (cachedFile !== undefined) return cachedFile;
  const url = rawUrl.startsWith('http') ? rawUrl : rawUrl.replace(/^\/+/, '');
  const fileKey = url.replace(/^\/+/, '');

  const mediaSetting = await getStorageSettings();
  if (!mediaSetting || !mediaSetting.credentials) return null;
  const { name: storageType, credentials } = mediaSetting;

  const tryCandidates = async (candidates, fetcher) => {
    for (const key of candidates) {
      try { return await fetcher(key); } catch (_) { /* try next */ }
    }
    return null;
  };

  const candidates = [fileKey];
  if (!fileKey.endsWith('.json')) candidates.push(fileKey + '.json');
  if (fileKey.endsWith('.json')) candidates.push(fileKey.replace(/\.json$/, ''));
  const bare = fileKey.replace(/^images\//, '');
  if (!candidates.includes(bare)) candidates.push(bare);
  if (!candidates.includes(bare + '.json')) candidates.push(bare + '.json');

  let fetchedText = null;
  if (storageType === 'aws_s3') {
    const s3 = new S3Client({
      region: credentials.awsRegionName,
      credentials: { accessKeyId: credentials.awsAccessKey, secretAccessKey: credentials.awsSecretKey },
    });
    fetchedText = await tryCandidates(candidates, async (key) => {
      const resp = await s3.send(new GetObjectCommand({ Bucket: credentials.awsBucketName, Key: key }));
      return await resp.Body.transformToString();
    });
  } else if (storageType === 'gcs') {
    const gcs = new Storage({
      projectId: credentials.gcsProjectId,
      keyFilename: path.join(__dirname, '../fcm_keys/serviceAccountKey.json'),
    });
    fetchedText = await tryCandidates(candidates, async (key) => {
      const [buf] = await gcs.bucket(credentials.gcsBucketName).file(key).download();
      return buf.toString('utf-8');
    });
  } else if (storageType === 'azure') {
    try {
      const blobServiceClient = BlobServiceClient.fromConnectionString(credentials.azureConnectionString);
      const blockBlobClient = blobServiceClient.getContainerClient(credentials.azureContainerName).getBlockBlobClient(fileKey);
      const resp = await blockBlobClient.download(0);
      const chunks = [];
      for await (const chunk of resp.readableStreamBody) chunks.push(chunk);
      fetchedText = Buffer.concat(chunks).toString('utf-8');
    } catch (_) { fetchedText = null; }
  } else {
    // local
    const filePath = path.join(__dirname, '../../public', fileKey);
    if (fs.existsSync(filePath)) fetchedText = fs.readFileSync(filePath, 'utf-8');
    else if (!fileKey.endsWith('.json')) {
      const p2 = path.join(__dirname, '../../public', fileKey + '.json');
      if (fs.existsSync(p2)) fetchedText = fs.readFileSync(p2, 'utf-8');
    }
  }
  if (fetchedText !== null && fetchedText !== undefined) {
    setFileCache(rawUrl, fetchedText);
  }
  return fetchedText;
};

const fetchFileAsJson = async (rawUrl) => {
  const text = await fetchFileAsText(rawUrl);
  if (!text) return null;
  try { return JSON.parse(text); } catch (_) { return null; }
};

module.exports = { fetchFileAsText, fetchFileAsJson };
