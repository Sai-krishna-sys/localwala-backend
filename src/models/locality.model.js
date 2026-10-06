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

// locality
const mongoose = require('mongoose');
const { toJSON, slugGenerator, paginate } = require('./plugins');

const localitySchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
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
    city: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'City',
      required: true,
    },
    translations: {
      type: Array,
      default: [],
    },
    slug: {
      type: 'String',
      source: 'name',
      unique: true,
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
localitySchema.plugin(toJSON);
localitySchema.plugin(slugGenerator);
localitySchema.plugin(paginate);
localitySchema.index({ location: '2dsphere' });

localitySchema.statics.isNameTaken = async function (name, excludeLocalityId) {
  const locality = await this.findOne({ name, _id: { $ne: excludeLocalityId } });
  return !!locality;
};

/**
 * @typedef Locality
 */
const Locality = mongoose.model('Locality', localitySchema);

module.exports = Locality;

