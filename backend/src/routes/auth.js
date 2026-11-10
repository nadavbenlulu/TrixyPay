const bcrypt = require('bcryptjs');
const express = require('express');
const jwt = require('jsonwebtoken');
const {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} = require('@simplewebauthn/server');
const User = require('../models/User');
const authenticate = require('../middleware/authenticate');
const {
  allowedOrigins,
  jwtSecret,
  nodeEnv,
  cookieSameSite,
} = require('../config');

const router = express.Router();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const usernamePattern = /^[a-zA-Z0-9._-]{3,30}$/;
const cookieName = 'trixpay_session';
const cookieOptions = {
  httpOnly: true,
  secure: nodeEnv === 'production',
  sameSite: cookieSameSite,
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};
const passkeyChallengeLifetimeMs = 5 * 60 * 1000;

function passkeyOrigin(req) {
  const origin = req.get('origin');
  const host = req.get('host');
  if (!origin || !host) {
    return null;
  }

  try {
    const parsedOrigin = new URL(origin);
    const isSecure =
      parsedOrigin.protocol === 'https:' || parsedOrigin.hostname === 'localhost';
    const isSameOrigin =
      parsedOrigin.host.toLowerCase() === host.toLowerCase() &&
      parsedOrigin.protocol === `${req.protocol}:`;
    if (
      parsedOrigin.origin !== origin ||
      !isSecure ||
      (!isSameOrigin && !allowedOrigins.includes(parsedOrigin.origin))
    ) {
      return null;
    }

    return { origin: parsedOrigin.origin, rpID: parsedOrigin.hostname };
  } catch {
    return null;
  }
}

function accountQuery(identifier) {
  if (
    typeof identifier !== 'string' ||
    identifier.length > 254 ||
    (!emailPattern.test(identifier) && !usernamePattern.test(identifier))
  ) {
    return null;
  }
  const normalized = identifier.trim().toLowerCase();
  return emailPattern.test(normalized)
    ? { email: normalized }
    : { username: normalized };
}

function pendingPasskeyChallenge(userId, challengeType) {
  return User.findOneAndUpdate(
    {
      _id: userId,
      passkeyChallengeType: challengeType,
      passkeyChallengeCreatedAt: {
        $gte: new Date(Date.now() - passkeyChallengeLifetimeMs),
      },
    },
    {
      $unset: {
        passkeyChallenge: 1,
        passkeyChallengeType: 1,
        passkeyChallengeCreatedAt: 1,
      },
    },
    { new: false },
  ).select(
    '+passkeys +passkeyChallenge +passkeyChallengeType +passkeyChallengeCreatedAt',
  );
}

function publicUser(user) {
  return {
    id: user.id,
    contactName: user.contactName,
    businessName: user.businessName,
    role: user.role,
    username: user.username || '',
    email: user.email,
    profileImage: user.profileImage || '',
  };
}

function validateCredentials(body, includeProfile) {
  const password = typeof body.password === 'string' ? body.password : '';

  if (password.length < 10 || password.length > 72) {
    return { error: 'הסיסמה צריכה להכיל בין 10 ל־72 תווים.' };
  }

  if (!includeProfile) {
    const identifier =
      typeof body.identifier === 'string'
        ? body.identifier.trim()
        : typeof body.username === 'string'
          ? body.username.trim()
          : typeof body.email === 'string'
            ? body.email.trim()
            : '';

    if (
      !identifier ||
      identifier.length > 254 ||
      (!emailPattern.test(identifier) && !usernamePattern.test(identifier))
    ) {
      return { error: 'יש להזין שם משתמש או כתובת דוא״ל תקינים.' };
    }

    return {
      identifier: emailPattern.test(identifier)
        ? identifier.toLowerCase()
        : identifier.toLowerCase(),
      isEmail: emailPattern.test(identifier),
      password,
    };
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const username =
    typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';

  if (!emailPattern.test(email) || email.length > 254) {
    return { error: 'יש להזין כתובת דוא״ל תקינה.' };
  }
  if (!usernamePattern.test(username)) {
    return { error: 'שם המשתמש חייב להכיל 3–30 תווים באנגלית, מספרים, נקודה, מקף או קו תחתון.' };
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

  return { username, email, password, contactName, businessName, role };
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
      username: details.username,
      email: details.email,
      passwordHash,
    });

    return issueSession(req, res, user, 201);
  } catch (error) {
    if (error.code === 11000) {
      if (error.keyPattern && error.keyPattern.username) {
        return res.status(409).json({ message: 'שם המשתמש הזה כבר תפוס.' });
      }
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
    const user = await User.findOne(
      details.isEmail
        ? { email: details.identifier }
        : { username: details.identifier },
    ).select('+passwordHash');
    const passwordMatches =
      user && (await bcrypt.compare(details.password, user.passwordHash));

    if (!passwordMatches) {
      return res.status(401).json({ message: 'שם המשתמש או הסיסמה אינם נכונים.' });
    }

    return issueSession(req, res, user);
  } catch (error) {
    return next(error);
  }
});

router.post('/passkey/register/options', authenticate, async (req, res, next) => {
  const relyingParty = passkeyOrigin(req);
  if (!relyingParty) {
    return res.status(403).json({ message: 'לא ניתן להגדיר Passkey מהמקור הזה.' });
  }

  try {
    const user = await User.findById(req.userId).select('+passkeys');
    if (!user) {
      return res.status(401).json({ message: 'החשבון לא נמצא. יש להתחבר מחדש.' });
    }

    const options = await generateRegistrationOptions({
      rpName: 'TrixPay',
      rpID: relyingParty.rpID,
      userID: new Uint8Array(Buffer.from(user.id, 'utf8')),
      userName: user.username || user.email,
      userDisplayName: user.contactName,
      attestationType: 'none',
      excludeCredentials: user.passkeys.map((passkey) => ({
        id: passkey.id,
        transports: passkey.transports,
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'required',
      },
    });

    user.passkeyChallenge = options.challenge;
    user.passkeyChallengeType = 'registration';
    user.passkeyChallengeCreatedAt = new Date();
    await user.save();

    return res.json(options);
  } catch (error) {
    return next(error);
  }
});

router.post('/passkey/register/verify', authenticate, async (req, res, next) => {
  const relyingParty = passkeyOrigin(req);
  if (!relyingParty) {
    return res.status(403).json({ message: 'לא ניתן להגדיר Passkey מהמקור הזה.' });
  }

  try {
    const user = await pendingPasskeyChallenge(req.userId, 'registration');
    if (!user) {
      return res.status(400).json({ message: 'פג תוקף הבקשה. יש לנסות שוב.' });
    }

    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response: req.body,
        expectedChallenge: user.passkeyChallenge,
        expectedOrigin: relyingParty.origin,
        expectedRPID: relyingParty.rpID,
        requireUserVerification: true,
      });
    } catch {
      return res.status(400).json({ message: 'לא ניתן לאמת את ה־Passkey. יש לנסות שוב.' });
    }

    if (!verification.verified || !verification.registrationInfo) {
      return res.status(400).json({ message: 'לא ניתן לאמת את ה־Passkey. יש לנסות שוב.' });
    }

    const { credential, credentialDeviceType, credentialBackedUp } =
      verification.registrationInfo;
    if (user.passkeys.some((passkey) => passkey.id === credential.id)) {
      return res.status(409).json({ message: 'ה־Passkey הזה כבר מחובר לחשבון.' });
    }

    user.passkeyChallenge = undefined;
    user.passkeyChallengeType = undefined;
    user.passkeyChallengeCreatedAt = undefined;
    user.passkeys.push({
      id: credential.id,
      publicKey: Buffer.from(credential.publicKey),
      counter: credential.counter,
      transports: credential.transports || [],
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
    });
    await user.save();

    return res.json({ verified: true });
  } catch (error) {
    return next(error);
  }
});

router.post('/passkey/login/options', async (req, res, next) => {
  const identifier = typeof req.body?.identifier === 'string'
    ? req.body.identifier.trim().toLowerCase()
    : '';
  const query = accountQuery(identifier);
  if (!query) {
    return res.status(400).json({ message: 'יש להזין שם משתמש או כתובת דוא״ל תקינים.' });
  }

  const relyingParty = passkeyOrigin(req);
  if (!relyingParty) {
    return res.status(403).json({ message: 'לא ניתן להתחבר באמצעות Passkey מהמקור הזה.' });
  }

  try {
    const user = await User.findOne(query).select('+passkeys');
    if (!user || user.passkeys.length === 0) {
      return res.status(400).json({
        message: 'לא נמצא Passkey לחשבון הזה. אפשר להתחבר עם שם משתמש וסיסמה.',
      });
    }

    const options = await generateAuthenticationOptions({
      rpID: relyingParty.rpID,
      allowCredentials: user.passkeys.map((passkey) => ({
        id: passkey.id,
        transports: passkey.transports,
      })),
      userVerification: 'required',
    });

    user.passkeyChallenge = options.challenge;
    user.passkeyChallengeType = 'authentication';
    user.passkeyChallengeCreatedAt = new Date();
    await user.save();

    return res.json(options);
  } catch (error) {
    return next(error);
  }
});

router.post('/passkey/login/verify', async (req, res, next) => {
  const identifier = typeof req.body?.identifier === 'string'
    ? req.body.identifier.trim().toLowerCase()
    : '';
  const query = accountQuery(identifier);
  if (!query || typeof req.body?.response?.id !== 'string') {
    return res.status(400).json({ message: 'בקשת ההתחברות אינה תקינה.' });
  }

  const relyingParty = passkeyOrigin(req);
  if (!relyingParty) {
    return res.status(403).json({ message: 'לא ניתן להתחבר באמצעות Passkey מהמקור הזה.' });
  }

  try {
    const account = await User.findOne(query).select('+passkeys');
    if (!account) {
      return res.status(401).json({ message: 'לא ניתן לאמת את פרטי ה־Passkey.' });
    }
    const user = await pendingPasskeyChallenge(account.id, 'authentication');
    if (!user) {
      return res.status(400).json({ message: 'פג תוקף הבקשה. יש לנסות שוב.' });
    }

    const passkey = user.passkeys.find(
      (candidate) => candidate.id === req.body.response.id,
    );
    if (!passkey) {
      return res.status(401).json({ message: 'לא ניתן לאמת את פרטי ה־Passkey.' });
    }

    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response: req.body.response,
        expectedChallenge: user.passkeyChallenge,
        expectedOrigin: relyingParty.origin,
        expectedRPID: relyingParty.rpID,
        credential: {
          id: passkey.id,
          publicKey: new Uint8Array(passkey.publicKey),
          counter: passkey.counter,
          transports: passkey.transports,
        },
        requireUserVerification: true,
      });
    } catch {
      return res.status(401).json({ message: 'לא ניתן לאמת את פרטי ה־Passkey.' });
    }

    if (!verification.verified) {
      return res.status(401).json({ message: 'לא ניתן לאמת את פרטי ה־Passkey.' });
    }

    passkey.counter = verification.authenticationInfo.newCounter;
    user.passkeyChallenge = undefined;
    user.passkeyChallengeType = undefined;
    user.passkeyChallengeCreatedAt = undefined;
    await user.save();

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
