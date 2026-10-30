const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const env = require('./config/env');
const apiRoutes = require('./routes');
const errorHandler = require('./middleware/errorHandler');
const notFound = require('./middleware/notFound');

const app = express();

// 1. Security Headers via Helmet
app.use(helmet({
  contentSecurityPolicy: env.NODE_ENV === 'production' ? undefined : false
}));

// 2. CORS setup for Client Origin
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || origin === env.CLIENT_URL || origin === 'http://localhost:5173' || origin === 'http://127.0.0.1:5173' || /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Blocked by CORS policy'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// 3. Rate Limiting for DoS protection
const limiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP address, please try again later.'
  }
});
app.use('/api', limiter);

// 4. Request Logging
if (env.NODE_ENV !== 'test') {
  app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// 5. Body Parsers with payload limits
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// 6. Mount API routes
app.use('/api', apiRoutes);

// 7. Fallback 404 handler
app.use(notFound);

// 8. Global Centralized Error Handler
app.use(errorHandler);

module.exports = app;
