const crypto = require('crypto');
const express = require('express');
const User = require('../models/User');
const authenticate = require('../middleware/authenticate');
const { bankDetailsEncryptionKey } = require('../config');

const router = express.Router();
const imagePattern = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

router.use(authenticate);

function encryptBankDetails(details) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', bankDetailsEncryptionKey, iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(details), 'utf8'),
    cipher.final(),
  ]);
  return [
    iv.toString('hex'),
    cipher.getAuthTag().toString('hex'),
    encrypted.toString('hex'),
  ].join(':');
}

function profileResponse(user) {
  return {
    profile: {
      businessName: user.businessName,
      businessRegistrationNumber: user.businessRegistrationNumber || '',
      profileImage: user.profileImage || '',
      bankDetailsSaved: Boolean(user.bankAccountLast4),
      bankAccountLast4: user.bankAccountLast4 || '',
    },
  };
}

router.get('/', async (req, res, next) => {
  try {
    const user = await User.findById(req.userId).select('+bankAccountLast4');
    if (!user) {
      return res.status(401).json({ message: 'החשבון לא נמצא. יש להתחבר מחדש.' });
    }
    return res.json(profileResponse(user));
  } catch (error) {
    return next(error);
  }
});

router.patch('/', async (req, res, next) => {
  try {
    const user = await User.findById(req.userId).select('+bankDetailsEncrypted +bankAccountLast4');
    if (!user) {
      return res.status(401).json({ message: 'החשבון לא נמצא. יש להתחבר מחדש.' });
    }

    if (Object.hasOwn(req.body, 'businessName')) {
      const businessName = typeof req.body.businessName === 'string'
        ? req.body.businessName.trim()
        : '';
      if (!businessName || businessName.length > 120) {
        return res.status(400).json({ message: 'יש להזין שם עסק תקין (עד 120 תווים).' });
      }
      if (req.body.businessNameConfirmed !== true) {
        return res.status(400).json({ message: 'יש לאשר ששם זה יופיע במסמכי העסק.' });
      }
      user.businessName = businessName;
    }

    if (Object.hasOwn(req.body, 'businessRegistrationNumber')) {
      const registrationNumber = typeof req.body.businessRegistrationNumber === 'string'
        ? req.body.businessRegistrationNumber.trim()
        : '';
      if (registrationNumber && !/^\d{5,15}$/.test(registrationNumber.replace(/-/g, ''))) {
        return res.status(400).json({ message: 'יש להזין מספר ח.פ / עוסק מורשה תקין.' });
      }
      user.businessRegistrationNumber = registrationNumber;
    }

    if (Object.hasOwn(req.body, 'profileImage')) {
      const profileImage = req.body.profileImage;
      if (profileImage !== '' && (
        typeof profileImage !== 'string'
        || profileImage.length > 700000
        || !imagePattern.test(profileImage)
      )) {
        return res.status(400).json({ message: 'התמונה אינה תקינה או גדולה מדי. יש לבחור תמונה קטנה יותר.' });
      }
      user.profileImage = profileImage;
    }

    const bankFields = ['bankName', 'branchNumber', 'accountNumber', 'accountHolder'];
    const hasBankDetails = bankFields.some((field) => Object.hasOwn(req.body, field));
    if (hasBankDetails) {
      const bankName = typeof req.body.bankName === 'string' ? req.body.bankName.trim() : '';
      const branchNumber = typeof req.body.branchNumber === 'string' ? req.body.branchNumber.trim() : '';
      const accountHolder = typeof req.body.accountHolder === 'string' ? req.body.accountHolder.trim() : '';
      const accountNumber = typeof req.body.accountNumber === 'string'
        ? req.body.accountNumber.replace(/[\s-]/g, '')
        : '';

      if (
        !bankName || bankName.length > 80
        || !/^\d{1,5}$/.test(branchNumber)
        || !/^\d{4,20}$/.test(accountNumber)
        || !accountHolder || accountHolder.length > 120
      ) {
        return res.status(400).json({ message: 'יש למלא שם בנק, סניף, מספר חשבון ושם בעל/ת חשבון תקינים.' });
      }

      user.bankDetailsEncrypted = encryptBankDetails({
        bankName,
        branchNumber,
        accountNumber,
        accountHolder,
      });
      user.bankAccountLast4 = accountNumber.slice(-4);
    }

    await user.save();
    return res.json(profileResponse(user));
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
