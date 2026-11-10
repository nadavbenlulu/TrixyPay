const mongoose = require('mongoose');

const passkeySchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    publicKey: { type: Buffer, required: true },
    counter: { type: Number, required: true, default: 0 },
    transports: { type: [String], default: [] },
    deviceType: { type: String, required: true },
    backedUp: { type: Boolean, required: true, default: false },
  },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    contactName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    businessName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    role: {
      type: String,
      required: true,
      enum: ['business', 'supplier'],
    },
    username: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    businessRegistrationNumber: {
      type: String,
      trim: true,
      maxlength: 20,
      default: '',
    },
    profileImage: {
      type: String,
      maxlength: 700000,
      default: '',
    },
    bankDetailsEncrypted: {
      type: String,
      select: false,
      default: '',
    },
    bankAccountLast4: {
      type: String,
      select: false,
      default: '',
    },
    passkeys: {
      type: [passkeySchema],
      default: [],
      select: false,
    },
    passkeyChallenge: {
      type: String,
      select: false,
    },
    passkeyChallengeType: {
      type: String,
      enum: ['registration', 'authentication'],
      select: false,
    },
    passkeyChallengeCreatedAt: {
      type: Date,
      select: false,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model('User', userSchema);
