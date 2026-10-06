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
const { toJSON } = require('./plugins');

const paymentInitiationSchema = mongoose.Schema(
  {
    user: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'User',
      required: false,
    },
    payment: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'PaymentConfig',
      required: true,
    },
    orders: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'Orders',
      required: false,
    },
    tiffinSubscription: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'UserPurchasedTiffinSubscription',
      required: false,
    },
    booking: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'DiningBooking',
      required: false,
    },
    restaurantRegisterRequest: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'RestaurantJoiningRequest',
      required: false,
    },
    subscribeId: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'Subscriber',
      required: false,
    },
    amount: {
      type: Number,
      required: false,
      get: (v) => Number((v / 100).toFixed(2)),
      set: (v) => Math.round(v * 100),
      default: 0,
    },
    paymentFrom: {
      type: String,
      required: true,
      default: 'order', // order // wallet // tiffinsubscription // booking // restaurant_register // renew_subscription
    },
    paymentRef: {
      type: String,
      required: false,
    },
    payResponse: {
      type: Object,
      required: false,
    },
    from: {
      type: String,
      default: 'app',
    },
    redirect: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      default: 'initiated', // initiated, paid, cancelled
    },
  },
  {
    timestamps: true,
    toJSON: { getters: true },
  }
);

// add plugin that converts mongoose to json & convert to unique slug
paymentInitiationSchema.plugin(toJSON);

/**
 * @typedef PaymentInitiation
 */
const PaymentInitiation = mongoose.model('PaymentInitiation', paymentInitiationSchema);

module.exports = PaymentInitiation;

