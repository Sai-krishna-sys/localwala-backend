const mongoose = require('mongoose');

const supportTransferLogSchema = new mongoose.Schema({
  chatRoom: { type: mongoose.Schema.Types.ObjectId, ref: 'SupportChatRoom', index: true },
  action: {
    type: String,
    enum: ['claim', 'reassign', 'unassign', 'take_ownership', 'auto_assign'],
    required: true,
    index: true,
  },
  fromAgent: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  toAgent: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  supportType: { type: String },
  priority: { type: String },
  reason: { type: String },
}, { timestamps: true });

supportTransferLogSchema.index({ createdAt: -1 });
supportTransferLogSchema.index({ toAgent: 1, createdAt: -1 });
supportTransferLogSchema.index({ fromAgent: 1, createdAt: -1 });

module.exports = mongoose.model('SupportTransferLog', supportTransferLogSchema);
