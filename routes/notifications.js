const express = require('express');
const router = express.Router();
const Retailer = require('../models/Retailer');
const Wholesaler = require('../models/Wholesaler');
const Salesman = require('../models/Salesman');
const { sendPushNotification } = require('../services/notificationService');
const { verifyToken } = require('../middleware/auth');

/**
 * Register device push token
 * POST /notifications/register
 */
router.post('/register', verifyToken, async (req, res) => {
  try {
    const { pushToken } = req.body;
    const { userId, userType } = req.user;

    if (!pushToken) {
      return res.status(400).json({ error: 'Push token is required' });
    }

    // Validate Expo push token format
    if (!pushToken.startsWith('ExponentPushToken')) {
      return res.status(400).json({ error: 'Invalid push token format' });
    }

    let user;
    if (userType === 'retailer') {
      user = await Retailer.findByIdAndUpdate(
        userId,
        { pushToken },
        { new: true }
      );
    } else if (userType === 'wholesaler') {
      user = await Wholesaler.findByIdAndUpdate(
        userId,
        { pushToken },
        { new: true }
      );
    } else if (userType === 'salesman') {
      user = await Salesman.findByIdAndUpdate(
        userId,
        { pushToken },
        { new: true }
      );
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ 
      message: 'Push token registered successfully',
      pushToken: user.pushToken
    });
  } catch (error) {
    console.error('Register push token error:', error);
    res.status(500).json({ error: 'Failed to register push token' });
  }
});

/**
 * Send test notification
 * POST /notifications/test
 */
router.post('/test', verifyToken, async (req, res) => {
  try {
    const { userId, userType } = req.user;

    let user;
    if (userType === 'retailer') {
      user = await Retailer.findById(userId);
    } else if (userType === 'wholesaler') {
      user = await Wholesaler.findById(userId);
    } else if (userType === 'salesman') {
      user = await Salesman.findById(userId);
    }

    if (!user || !user.pushToken) {
      return res.status(400).json({ 
        error: 'No push token registered. Please enable notifications in the app.' 
      });
    }

    const result = await sendPushNotification(
      user.pushToken,
      '🎉 Test Notification',
      'Push notifications are working perfectly!',
      { type: 'test' }
    );

    if (result) {
      res.json({ 
        message: 'Test notification sent successfully',
        result 
      });
    } else {
      res.status(500).json({ error: 'Failed to send test notification' });
    }
  } catch (error) {
    console.error('Test notification error:', error);
    res.status(500).json({ error: 'Failed to send test notification' });
  }
});

/**
 * Unregister push token (logout)
 * POST /notifications/unregister
 */
router.post('/unregister', verifyToken, async (req, res) => {
  try {
    const { userId, userType } = req.user;

    let user;
    if (userType === 'retailer') {
      user = await Retailer.findByIdAndUpdate(
        userId,
        { pushToken: null },
        { new: true }
      );
    } else if (userType === 'wholesaler') {
      user = await Wholesaler.findByIdAndUpdate(
        userId,
        { pushToken: null },
        { new: true }
      );
    } else if (userType === 'salesman') {
      user = await Salesman.findByIdAndUpdate(
        userId,
        { pushToken: null },
        { new: true }
      );
    }

    res.json({ message: 'Push token unregistered successfully' });
  } catch (error) {
    console.error('Unregister push token error:', error);
    res.status(500).json({ error: 'Failed to unregister push token' });
  }
});

module.exports = router;
