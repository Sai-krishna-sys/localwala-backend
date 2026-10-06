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

const express = require('express');
const authRoute = require('./auth.route');
const userRoute = require('./user.route');
const adminRoute = require('./admin.route');
const fileRoute = require('./file.route');
const driverRoute = require('./driver.route');
const publicRoute = require('./public.route');
const vendorRoute = require('./vendor.route');
const vendorWebRoute = require('./vendor_web.route');
const waiterRoute = require('./waiter.route');
const accontantRoute = require('./accountant.route');
const supportTeamRoute = require('./support.team.route');
const cityZenRoute = require('./cityzen.route');
const kitchenRoute = require('./kitchen.route');

const router = express.Router();

const defaultRoutes = [
  {
    path: '/auth',
    route: authRoute,
  },
  {
    path: '/users',
    route: userRoute,
  },
  {
    path: '/admin',
    route: adminRoute,
  },
  {
    path: '/vendor',
    route: vendorRoute,
  },
  {
    path: '/vendor_web',
    route: vendorWebRoute,
  },
  {
    path: '/driver',
    route: driverRoute,
  },
  {
    path: '/file',
    route: fileRoute,
  },
  {
    path: '/public',
    route: publicRoute,
  },
  {
    path: '/waiter',
    route: waiterRoute,
  },
  {
    path: '/accountant',
    route: accontantRoute,
  },
  {
    path: '/support_team',
    route: supportTeamRoute,
  },
  {
    path: '/cityzen',
    route: cityZenRoute,
  },
  {
    path: '/kitchen',
    route: kitchenRoute,
  },
];

defaultRoutes.forEach((route) => {
  router.use(route.path, route.route);
});

module.exports = router;

