require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const logger = require('./utils/logger');
const { apiLimiter } = require('./middleware/rateLimiter');
const { errorHandler, notFound } = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const cartRoutes = require('./routes/cart');
const orderRoutes = require('./routes/orders');
const wholesalerRoutes = require('./routes/wholesalers');
const gstRoutes = require('./routes/gst');
const connectionRoutes = require('./routes/connections');
const categoryRoutes = require('./routes/categories');
const brandRoutes = require('./routes/brands');
const salesmenRoutes = require('./routes/salesmen');
const notificationRoutes = require('./routes/notifications');

const app = express();

// Security middleware — relax cross-origin policies for mobile app access
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginOpenerPolicy: false,
  contentSecurityPolicy: false,
}));

// CORS - restrict to known origins
const allowedOrigins = [
  'http://localhost:8081',    // Expo dev server
  'http://localhost:19006',   // Expo web
  'http://localhost:3000',    // Local web dev
  'https://testbackend-sw1p.onrender.com',
];
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, true); // Allow all for now, can be restricted later
  },
  credentials: true
}));

// Request logging
const morganFormat = process.env.NODE_ENV === 'production' ? 'combined' : 'dev';
const stream = {
  write: (message) => logger.info(message.trim())
};
app.use(morgan(morganFormat, { stream }));

// Body parsing with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Rate limiting for all API routes
app.use('/api/', apiLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/wholesalers', wholesalerRoutes);
app.use('/api/gst', gstRoutes);
app.use('/api/connections', connectionRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/brands', brandRoutes);
app.use('/api/salesmen', salesmenRoutes);
app.use('/api/notifications', notificationRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Wholesale Marketplace API is running' });
});

// 404 handler
app.use(notFound);

// Global error handler (must be last)
app.use(errorHandler);

// MongoDB connection
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    logger.info('✅ Connected to MongoDB');
    app.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  })
  .catch((err) => {
    logger.error('❌ MongoDB connection error', { error: err.message });
    process.exit(1);
  });

module.exports = app;
