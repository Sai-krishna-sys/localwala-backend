const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

const supportConfigSchema = mongoose.Schema(
  {
    slaTargets: {
      orders: { type: Number, default: 30 },
      dining: { type: Number, default: 30 },
      tiffin_subscription: { type: Number, default: 30 },
      complaints: { type: Number, default: 30 },
      reports: { type: Number, default: 30 },
      restaurant_complaints: { type: Number, default: 30 },
    },
    autoEscalation: {
      enabled: { type: Boolean, default: false },
      afterMinutes: { type: Number, default: 15 },
      escalateTo: {
        type: String,
        enum: ['manager', 'next_agent', 'all'],
        default: 'manager',
      },
    },
    autoClose: {
      enabled: { type: Boolean, default: false },
      afterResolvedMinutes: { type: Number, default: 48 },
      afterInactiveMinutes: { type: Number, default: 1440 },
    },
    frtTargetMinutes: { type: Number, default: 5 },
    csatTarget: { type: Number, default: 4.0 },
  },
  {
    timestamps: true,
    toJSON: { getters: true },
  }
);

supportConfigSchema.plugin(toJSON);
supportConfigSchema.plugin(paginate);

const SupportConfig = mongoose.model('SupportConfig', supportConfigSchema);

module.exports = SupportConfig;
