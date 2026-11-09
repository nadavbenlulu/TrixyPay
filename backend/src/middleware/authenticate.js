const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config');

function authenticate(req, res, next) {
  const authorization = req.get('authorization');
  const bearerToken = authorization?.startsWith('Bearer ')
    ? authorization.slice(7)
    : null;
  const token = bearerToken || req.cookies?.trixpay_session;

  if (!token) {
    return res.status(401).json({ message: 'יש להתחבר כדי להמשיך.' });
  }

  try {
    const payload = jwt.verify(token, jwtSecret);
    req.userId = payload.sub;
    return next();
  } catch {
    return res.status(401).json({ message: 'פג תוקף ההתחברות. יש להתחבר מחדש.' });
  }
}

module.exports = authenticate;
