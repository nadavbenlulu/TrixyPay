const cookieParser = require('cookie-parser');
const cors = require('cors');
const express = require('express');
const helmet = require('helmet');
const mongoose = require('mongoose');
const path = require('path');
const rateLimit = require('express-rate-limit');
const {
  allowedOrigins,
  mongoUri,
  nodeEnv,
  port,
} = require('./config');
const authRoutes = require('./routes/auth');
const partnerRoutes = require('./routes/partners');
const purchaseRoutes = require('./routes/purchases');
const profileRoutes = require('./routes/profile');

const app = express();

app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet());
app.use((req, res, next) => {
  const corsMiddleware = cors({
    credentials: true,
    origin(origin, callback) {
      let isSameOrigin = false;
      if (origin) {
        try {
          const parsedOrigin = new URL(origin);
          isSameOrigin =
            parsedOrigin.host === req.get('host') &&
            parsedOrigin.protocol === `${req.protocol}:`;
        } catch {
          isSameOrigin = false;
        }
      }

      if (!origin || isSameOrigin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Origin is not allowed by CORS.'));
    },
  });
  return corsMiddleware(req, res, next);
});
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  });
});

app.use(
  '/api/auth',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { message: 'בוצעו יותר מדי ניסיונות. נסו שוב בעוד 15 דקות.' },
  }),
  authRoutes,
);
app.use('/api/partners', partnerRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/profile', profileRoutes);
app.use(express.static(path.resolve(__dirname, '../../mobile/dist')));

app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }
  if (error.message === 'Origin is not allowed by CORS.') {
    return res.status(403).json({ message: 'המקור אינו מורשה.' });
  }
  if (nodeEnv !== 'production') {
    console.error(error);
  }
  return res.status(500).json({ message: 'אירעה שגיאה בשרת. נסו שוב מאוחר יותר.' });
});

async function start() {
  await mongoose.connect(mongoUri);
  app.listen(port, '0.0.0.0', () => {
    console.log(`TrixPay API listening on port ${port}`);
  });
}

start().catch((error) => {
  console.error('Failed to start the API server:', error.message);
  process.exitCode = 1;
});
