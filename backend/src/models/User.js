const mongoose = require('mongoose');

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
  },
  { timestamps: true },
);

module.exports = mongoose.model('User', userSchema);
