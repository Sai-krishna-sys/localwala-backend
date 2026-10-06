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

const multer = require('multer');
const { status: httpStatus } = require('http-status');
const path = require('path');
const config = require('../config/config');
const ApiError = require('../utils/ApiError');

function randomUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getExtensionFromMime(mimeType) {
  const mimeMap = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'image/svg+xml': '.svg',
  };
  return mimeMap[mimeType] || '';
}

const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, config.folder.public);
  },
  filename: (req, file, cb) => {
    try {
      const extName = path.extname(file.originalname) || getExtensionFromMime(file.mimetype);
      const uniqueFileName = `${randomUUID()}${extName}`;
      cb(null, uniqueFileName);
      // eslint-disable-next-line no-unused-vars
    } catch (_error) {
      cb(new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Error creating unique file name'));
    }
  },
});

const memoryStorage = multer.memoryStorage();

const upload = (storageType = 'local') => {
  const chosenStorage = storageType === 'local' ? diskStorage : memoryStorage;
  return multer({
    storage: chosenStorage,
    limits: { fileSize: config.file.maxUploadSize },
    fileFilter: (req, file, cb) => {
      try {
        const arrFileType = config.file.allowUploadFileType.split(',');
        if (arrFileType.includes(file.mimetype)) {
          cb(null, true);
        } else {
          const arrMimeType = arrFileType.map((type) => type.split('/')[1]);
          cb(
            new ApiError(
              httpStatus.BAD_REQUEST,
              `Only ${arrMimeType.join(', ')} files are allowed!`
            )
          );
        }
        // eslint-disable-next-line no-unused-vars
      } catch (_err) {
        cb(new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'File filter error'));
      }
    },
  });
};

module.exports = upload;

