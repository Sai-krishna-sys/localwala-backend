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

const dotenv = require('dotenv');
const path = require('path');
const Joi = require('joi');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const envInput = {
  ...process.env,
  MONGODB_URL: process.env.MONGODB_URL,
  SERVER_TIMEZONE: process.env.SERVER_TIMEZONE,
  REDIS_URL: process.env.REDIS_URL,
  VALKEY_URL: process.env.VALKEY_URL,
};

const envVarsSchema = Joi.object()
  .keys({
    NODE_ENV: Joi.string().valid('production', 'development', 'test').default('development'),
    PORT: Joi.number().default(3000),
    MONGODB_URL: Joi.string().required().description('Mongo DB url'),
    REDIS_URL: Joi.string().allow('').default('').description('Redis/Valkey URL (optional, fallback to in-memory)'),
    VALKEY_URL: Joi.string().allow('').default('').description('Valkey URL alias for REDIS_URL'),
    JWT_SECRET: Joi.string().default('change-this-secret').description('JWT secret key'),
    JWT_EXPIRES_IN: Joi.string().optional(),
    JWT_ACCESS_EXPIRATION_MINUTES: Joi.number()
      .default(1600)
      .description('minutes after which access tokens expire'),
    JWT_REFRESH_EXPIRATION_DAYS: Joi.number().default(365),
    JWT_RESET_PASSWORD_EXPIRATION_MINUTES: Joi.number().default(10),
    JWT_VERIFY_EMAIL_EXPIRATION_MINUTES: Joi.number().default(10),
    SERVER_TIMEZONE: Joi.string().default('UTC').description('Default Server Timezone'),
    CLIENT_ORIGINS: Joi.string().default('http://localhost:4200'),
    JWT_COOKIE_NAME: Joi.string().default('access_token'),
    JWT_REFRESH_COOKIE_NAME: Joi.string().default('refresh_token'),
    JWT_COOKIE_MAX_AGE_MS: Joi.number().optional(),
    JWT_COOKIE_DOMAIN: Joi.string().allow('').default(''),
    JWT_COOKIE_SAME_SITE: Joi.string().valid('lax', 'strict', 'none', '').default(''),
    JWT_COOKIE_SECURE: Joi.string().valid('auto', 'true', 'false').default('auto'),
    FOLDER_PUBLIC: Joi.string().default('./public/'),
    MAX_UPLOAD_FILE_SIZE: Joi.number().default(1048576),
    PREPEND_UPLOAD_FILE_NAME_METHOD: Joi.string().default('millisecond'),
    PREPEND_UPLOAD_FILE_NAME_RANDOM_STRING_LENGTH: Joi.number().default(10),
    ALLOW_UPLOAD_FILE_TYPE: Joi.string().allow('').default(''),
  })
  .unknown();

const { value: envVars, error } = envVarsSchema
  .prefs({ errors: { label: 'key' } })
  .validate(envInput);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

const jwtExpiresIn = envVars.JWT_EXPIRES_IN || `${envVars.JWT_ACCESS_EXPIRATION_MINUTES}m`;
const jwtCookieMaxAgeMs =
  envVars.JWT_COOKIE_MAX_AGE_MS || envVars.JWT_ACCESS_EXPIRATION_MINUTES * 60 * 1000;

module.exports = {
  env: envVars.NODE_ENV,
  port: envVars.PORT,
  mongoose: {
    url: envVars.MONGODB_URL + (envVars.NODE_ENV === 'test' ? '-test' : ''),
    options: {},
  },
  jwt: {
    secret: envVars.JWT_SECRET,
    expiresIn: jwtExpiresIn,
    accessExpirationMinutes: envVars.JWT_ACCESS_EXPIRATION_MINUTES,
    refreshExpirationDays: envVars.JWT_REFRESH_EXPIRATION_DAYS,
    resetPasswordExpirationMinutes: envVars.JWT_RESET_PASSWORD_EXPIRATION_MINUTES,
    verifyEmailExpirationMinutes: envVars.JWT_VERIFY_EMAIL_EXPIRATION_MINUTES,
    cookieName: envVars.JWT_COOKIE_NAME,
    refreshCookieName: envVars.JWT_REFRESH_COOKIE_NAME,
    cookieMaxAgeMs: jwtCookieMaxAgeMs,
    refreshCookieMaxAgeMs: envVars.JWT_REFRESH_EXPIRATION_DAYS * 24 * 60 * 60 * 1000,
    cookieDomain: envVars.JWT_COOKIE_DOMAIN || undefined,
    cookieSameSite: envVars.JWT_COOKIE_SAME_SITE || undefined,
    cookieSecure: envVars.JWT_COOKIE_SECURE,
  },
  redis: {
    url: envVars.REDIS_URL || envVars.VALKEY_URL || '',
  },
  cors: {
    origins: envVars.CLIENT_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  },
  timezone: envVars.SERVER_TIMEZONE,
  folder: {
    public: envVars.FOLDER_PUBLIC,
  },
  file: {
    maxUploadSize: Number(envVars.MAX_UPLOAD_FILE_SIZE),
    prependUploadFilenameMethod: envVars.PREPEND_UPLOAD_FILE_NAME_METHOD,
    randomStringLength: Number(envVars.PREPEND_UPLOAD_FILE_NAME_RANDOM_STRING_LENGTH),
    allowUploadFileType: envVars.ALLOW_UPLOAD_FILE_TYPE,
  },
};

