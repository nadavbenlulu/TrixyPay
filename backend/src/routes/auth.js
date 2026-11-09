const bcrypt = require('bcryptjs');
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const authenticate = require('../middleware/authenticate');
const { jwtSecret, nodeEnv, cookieSameSite } = require('../config');

const router = express.Router();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const cookieName = 'trixpay_session';
const cookieOptions = {
  httpOnly: true,
  secure: nodeEnv === 'production',
  sameSite: cookieSameSite,
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

function publicUser(user) {
  return {
    id: user.id,
    contactName: user.contactName,
    businessName: user.businessName,
    role: user.role,
    email: user.email,
  };
}

function validateCredentials(body, includeProfile) {
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!emailPattern.test(email) || email.length > 254) {
    return { error: 'יש להזין כתובת דוא״ל תקינה.' };
  }
  if (password.length < 10 || password.length > 72) {
    return { error: 'הסיסמה צריכה להכיל בין 10 ל־72 תווים.' };
  }

  if (!includeProfile) {
    return { email, password };
  }

  const contactName =
    typeof body.contactName === 'string' ? body.contactName.trim() : '';
  const businessName =
    typeof body.businessName === 'string' ? body.businessName.trim() : '';
  const role = body.role;

  if (!contactName || contactName.length > 100) {
    return { error: 'יש להזין שם איש קשר (עד 100 תווים).' };
  }
  if (!businessName || businessName.length > 120) {
    return { error: 'יש להזין שם עסק (עד 120 תווים).' };
  }
  if (!['business', 'supplier'].includes(role)) {
    return { error: 'יש לבחור סוג חשבון.' };
  }

  return { email, password, contactName, businessName, role };
}

function issueSession(req, res, user, statusCode = 200) {
  const token = jwt.sign({}, jwtSecret, {
    subject: user.id,
    expiresIn: '7d',
  });

  if (req.get('x-client-platform') === 'native') {
    return res.status(statusCode).json({ user: publicUser(user), token });
  }

  res.cookie(cookieName, token, cookieOptions);
  return res.status(statusCode).json({ user: publicUser(user) });
}

router.post('/register', async (req, res, next) => {
  const details = validateCredentials(req.body, true);
  if (details.error) {
    return res.status(400).json({ message: details.error });
  }

  try {
    const passwordHash = await bcrypt.hash(details.password, 12);
    const user = await User.create({
      contactName: details.contactName,
      businessName: details.businessName,
      role: details.role,
      email: details.email,
      passwordHash,
    });

    return issueSession(req, res, user, 201);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'כבר קיים חשבון עם כתובת הדוא״ל הזו.' });
    }
    return next(error);
  }
});

router.post('/login', async (req, res, next) => {
  const details = validateCredentials(req.body, false);
  if (details.error) {
    return res.status(400).json({ message: details.error });
  }

  try {
    const user = await User.findOne({ email: details.email }).select('+passwordHash');
    const passwordMatches =
      user && (await bcrypt.compare(details.password, user.passwordHash));

    if (!passwordMatches) {
      return res.status(401).json({ message: 'כתובת הדוא״ל או הסיסמה אינן נכונות.' });
    }

    return issueSession(req, res, user);
  } catch (error) {
    return next(error);
  }
});

router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(401).json({ message: 'החשבון לא נמצא. יש להתחבר מחדש.' });
    }
    return res.json({ user: publicUser(user) });
  } catch (error) {
    return next(error);
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie(cookieName, { ...cookieOptions, maxAge: undefined });
  return res.json({ message: 'התנתקת בהצלחה.' });
});

module.exports = router;
