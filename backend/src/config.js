const dotenv = require('dotenv');

dotenv.config();

const required = ['MONGODB_URI', 'JWT_SECRET'];
for (const name of required) {
  if (!process.env[name]) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
}

if (!/^[\da-fA-F]{64}$/.test(process.env.BANK_DETAILS_ENCRYPTION_KEY || '')) {
  throw new Error('BANK_DETAILS_ENCRYPTION_KEY must be a 32-byte hexadecimal key.');
}

if (process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters long.');
}

const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:8081')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

module.exports = {
  allowedOrigins,
  bankDetailsEncryptionKey: Buffer.from(process.env.BANK_DETAILS_ENCRYPTION_KEY, 'hex'),
  cookieSameSite: process.env.COOKIE_SAME_SITE || 'lax',
  jwtSecret: process.env.JWT_SECRET,
  mongoUri: process.env.MONGODB_URI,
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 4000,
};
