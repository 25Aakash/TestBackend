const axios = require('axios');
const logger = require('../utils/logger');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Send push notification via Expo Push Notification Service
 * @param {string} pushToken - Expo push token
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {object} data - Additional data to send with notification
 */
const sendPushNotification = async (pushToken, title, body, data = {}) => {
  if (!pushToken || !pushToken.startsWith('ExponentPushToken')) {
    logger.warn('Invalid push token', { pushToken });
    return null;
  }

  try {
    const message = {
      to: pushToken,
      sound: 'default',
      title: title,
      body: body,
      data: data,
      priority: 'high',
      channelId: 'default'
    };

    const response = await axios.post(EXPO_PUSH_URL, message, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    logger.info('Push notification sent', { data: response.data });
    return response.data;
  } catch (error) {
    logger.error('Error sending push notification', { error: error.response?.data || error.message });
    return null;
  }
};

/**
 * Send order status notification
 * @param {object} user - User object with pushToken
 * @param {string} orderId - Order ID
 * @param {string} status - Order status
 * @param {string} orderNumber - Order number for display
 */
const sendOrderNotification = async (user, orderId, status, orderNumber) => {
  if (!user || !user.pushToken) {
    return null;
  }

  const statusMessages = {
    'pending': {
      title: '📦 Order Received',
      body: `Order #${orderNumber} has been received and is being processed.`
    },
    'confirmed': {
      title: '✅ Order Confirmed',
      body: `Order #${orderNumber} has been confirmed by the wholesaler.`
    },
    'processing': {
      title: '⚙️ Order Processing',
      body: `Order #${orderNumber} is being prepared for shipment.`
    },
    'shipped': {
      title: '🚚 Order Shipped',
      body: `Order #${orderNumber} has been shipped and is on the way!`
    },
    'delivered': {
      title: '🎉 Order Delivered',
      body: `Order #${orderNumber} has been delivered successfully.`
    },
    'cancelled': {
      title: '❌ Order Cancelled',
      body: `Order #${orderNumber} has been cancelled.`
    }
  };

  const notification = statusMessages[status] || {
    title: 'Order Update',
    body: `Order #${orderNumber} status: ${status}`
  };

  return sendPushNotification(
    user.pushToken,
    notification.title,
    notification.body,
    { orderId, status, type: 'order_update' }
  );
};

/**
 * Send new order notification to wholesaler
 * @param {object} wholesaler - Wholesaler object with pushToken
 * @param {string} orderId - Order ID
 * @param {string} orderNumber - Order number
 * @param {string} retailerName - Retailer business name
 */
const sendNewOrderNotification = async (wholesaler, orderId, orderNumber, retailerName) => {
  if (!wholesaler || !wholesaler.pushToken) {
    return null;
  }

  return sendPushNotification(
    wholesaler.pushToken,
    '🛒 New Order Received',
    `${retailerName} placed order #${orderNumber}`,
    { orderId, type: 'new_order' }
  );
};

/**
 * Send stock alert notification
 * @param {object} user - User object with pushToken
 * @param {string} productName - Product name
 * @param {number} currentStock - Current stock quantity
 */
const sendStockAlert = async (user, productName, currentStock) => {
  if (!user || !user.pushToken) {
    return null;
  }

  return sendPushNotification(
    user.pushToken,
    '⚠️ Low Stock Alert',
    `${productName} is running low (${currentStock} units remaining)`,
    { productName, currentStock, type: 'stock_alert' }
  );
};

/**
 * Send payment reminder notification
 * @param {object} retailer - Retailer object with pushToken
 * @param {number} amount - Outstanding amount
 */
const sendPaymentReminder = async (retailer, amount) => {
  if (!retailer || !retailer.pushToken) {
    return null;
  }

  return sendPushNotification(
    retailer.pushToken,
    '💰 Payment Reminder',
    `You have an outstanding amount of ₹${amount.toFixed(2)}`,
    { amount, type: 'payment_reminder' }
  );
};

/**
 * Send connection request notification
 * @param {object} user - User object with pushToken
 * @param {string} requesterName - Name of the person requesting connection
 */
const sendConnectionNotification = async (user, requesterName) => {
  if (!user || !user.pushToken) {
    return null;
  }

  return sendPushNotification(
    user.pushToken,
    '🤝 New Connection Request',
    `${requesterName} wants to connect with you`,
    { type: 'connection_request' }
  );
};

module.exports = {
  sendPushNotification,
  sendOrderNotification,
  sendNewOrderNotification,
  sendStockAlert,
  sendPaymentReminder,
  sendConnectionNotification
};
