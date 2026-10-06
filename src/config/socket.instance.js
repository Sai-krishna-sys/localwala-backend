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

/**
 * Holds the live Socket.IO instance so services (e.g. the support bot)
 * can emit into chat rooms outside of the connection handler.
 * Set once in server bootstrap (see src/index.js).
 */
let io = null;

const initSocketIO = (instance) => {
  io = instance;
};

const getSocketIO = () => io;

module.exports = {
  initSocketIO,
  getSocketIO,
};
