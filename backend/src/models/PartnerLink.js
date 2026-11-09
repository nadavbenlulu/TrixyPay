const mongoose = require('mongoose');

const partnerLinkSchema = new mongoose.Schema(
  {
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true },
);

partnerLinkSchema.index({ businessId: 1, supplierId: 1 }, { unique: true });

module.exports = mongoose.model('PartnerLink', partnerLinkSchema);
