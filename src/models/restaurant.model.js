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
const { toJSON, slugGenerator, paginate } = require('./plugins');

const restaurantSchema = mongoose.Schema(
  {
    userId: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'User',
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
      type: String,
      required: true,
    },
    shortDescription: {
      type: String,
      required: true,
    },
    cuisine: [
      {
        type: mongoose.SchemaTypes.ObjectId,
        ref: 'Cuisine',
        required: true,
      },
    ],
    category: [
      {
        type: mongoose.SchemaTypes.ObjectId,
        ref: 'Category',
        required: false,
      },
    ],
    diningCategory: [
      {
        type: mongoose.SchemaTypes.ObjectId,
        ref: 'DiningCategory',
        required: false,
      },
    ],
    logo: {
      type: String,
      required: true,
    },
    cover: {
      type: String,
      required: true,
    },
    city: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'City',
      required: true,
    },
    locality: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'Locality',
      required: false,
    },
    location: {
      type: {
        type: String, // Don't do `{ location: { type: String } }`
        enum: ['Point'], // 'location.type' must be 'Point'
        default: 'Point',
      },
      coordinates: {
        type: [Number],
        required: true,
      },
    },
    type: {
      type: String,
      required: true,
      default: 'commission', // commission or subscription or derived
    },
    commission: {
      type: Number,
      required: false,
      default: 0,
    },
    posOrderCommission: {
      type: Number,
      required: false,
      default: 0,
    },
    tableOrderCommission: {
      type: Number,
      required: false,
      default: 0,
    },
    subscription: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'Subscriptions',
      required: false,
    },
    approxDeliveryTime: {
      type: String,
      required: true,
    },
    dishPriceForTwo: {
      type: Number,
      get: (v) => Number((v / 100).toFixed(2)),
      set: (v) => Math.round(v * 100),
      required: true,
    },
    pos: {
      type: Boolean,
      default: false,
    },
    ownDriver: {
      type: Boolean,
      default: false,
    },
    promote: {
      type: Boolean,
      default: false,
    },
    customCategory: {
      type: Boolean,
      default: false,
    },
    multiOutlet: {
      type: Boolean,
      default: false,
    },
    preBooking: {
      type: Boolean,
      default: false,
    },
    tableOrder: {
      type: Boolean,
      default: false,
    },
    tiffinSubscription: {
      type: Boolean,
      default: false,
    },
    ownWaiter: {
      type: Boolean,
      default: false,
    },
    ownKitchen: {
      type: Boolean,
      default: false,
    },
    takeAway: {
      type: Boolean,
      default: true,
    },
    slug: {
      type: 'String',
      source: 'name',
      unique: true,
    },
    translations: {
      type: Array,
      default: [],
    },
    slots: {
      type: Array,
      default: [],
    },
    isOutlet: {
      type: Boolean,
      default: false,
    },
    outletManagerId: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'Restaurant',
      required: false,
    },
    orderLimit: {
      type: Number,
      default: -1, // -1 means unlimited
    },
    productLimit: {
      type: Number,
      default: -1, // -1 means unlimited
    },
    rating: {
      type: Number,
      default: 0,
    },
    restaurantType: [
      {
        type: mongoose.SchemaTypes.ObjectId,
        ref: 'RestaurantType',
        required: true,
      },
    ],
    restaurantFacility: [
      {
        type: mongoose.SchemaTypes.ObjectId,
        ref: 'RestaurantFacility',
        required: true,
      },
    ],
    temporaryClosed: {
      type: Boolean,
      default: false,
    },
    acceptScheduleDelivery: {
      type: Boolean,
      default: true,
    },
    acceptHomeDelivery: {
      type: Boolean,
      default: true,
    },
    minOrderAmount: {
      type: Number,
      default: 1000,
      get: (v) => Number((v / 100).toFixed(2)),
      set: (v) => Math.round(v * 100),
      required: true,
    },
    license: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'RestaurantFoodLicense',
      required: false,
    },
    licenseId: {
      type: String,
      default: '',
      required: false,
    },
    socialFacebook: {
      type: String,
      default: '',
      required: false,
    },
    socialInstagram: {
      type: String,
      default: '',
      required: false,
    },
    socialX: {
      type: String,
      default: '',
      required: false,
    },
    socialYoutube: {
      type: String,
      default: '',
      required: false,
    },
    socialLinkedIn: {
      type: String,
      default: '',
      required: false,
    },
    socialPinterest: {
      type: String,
      default: '',
      required: false,
    },
    status: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { getters: true },
  }
);

// add plugin that converts mongoose to json & convert to unique slug
restaurantSchema.plugin(toJSON);
restaurantSchema.plugin(slugGenerator);
restaurantSchema.plugin(paginate);
restaurantSchema.index({ location: '2dsphere' });

/**
 * @typedef Restaurant
 */
const Restaurant = mongoose.model('Restaurant', restaurantSchema);

module.exports = Restaurant;

