const express = require('express');
const Connection = require('../models/Connection');
const Wholesaler = require('../models/Wholesaler');
const Retailer = require('../models/Retailer');
const { verifyToken, isWholesaler, isRetailer } = require('../middleware/auth');

const router = express.Router();

// Retailer: Request connection with a wholesaler
router.post('/request', verifyToken, isRetailer, async (req, res) => {
  try {
    const { wholesaler_id, message } = req.body;

    if (!wholesaler_id) {
      return res.status(400).json({ error: 'Wholesaler ID is required' });
    }

    // Check if wholesaler exists
    const wholesaler = await Wholesaler.findById(wholesaler_id);
    if (!wholesaler) {
      return res.status(404).json({ error: 'Wholesaler not found' });
    }

    // Check if connection already exists
    const existingConnection = await Connection.findOne({
      wholesaler_id,
      retailer_id: req.user.userId
    });

    if (existingConnection) {
      if (existingConnection.status === 'approved') {
        return res.status(400).json({ error: 'You are already connected with this wholesaler' });
      } else if (existingConnection.status === 'pending') {
        return res.status(400).json({ error: 'Connection request already pending' });
      } else if (existingConnection.status === 'rejected') {
        // Allow re-request if previously rejected
        existingConnection.status = 'pending';
        existingConnection.message = message || '';
        existingConnection.requested_by = 'retailer';
        await existingConnection.save();
        return res.json({ 
          message: 'Connection request sent successfully',
          connection: existingConnection
        });
      }
    }

    // Create new connection request
    const connection = new Connection({
      wholesaler_id,
      retailer_id: req.user.userId,
      status: 'pending',
      requested_by: 'retailer',
      message: message || ''
    });

    await connection.save();

    res.status(201).json({
      message: 'Connection request sent successfully',
      connection
    });
  } catch (error) {
    console.error('Request connection error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Wholesaler: Get all connection requests and connections
router.get('/wholesaler/requests', verifyToken, isWholesaler, async (req, res) => {
  try {
    const { status } = req.query;
    
    let query = { wholesaler_id: req.user.userId };
    if (status) {
      query.status = status;
    }

    const connections = await Connection.find(query)
      .populate('retailer_id', 'business_name owner_name email phone city state')
      .sort({ createdAt: -1 });

    res.json(connections);
  } catch (error) {
    console.error('Get wholesaler connections error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Retailer: Get all connection requests and connections
router.get('/retailer/requests', verifyToken, isRetailer, async (req, res) => {
  try {
    const { status } = req.query;
    
    let query = { retailer_id: req.user.userId };
    if (status) {
      query.status = status;
    }

    const connections = await Connection.find(query)
      .populate('wholesaler_id', 'business_name owner_name email phone city state')
      .sort({ createdAt: -1 });

    res.json(connections);
  } catch (error) {
    console.error('Get retailer connections error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Wholesaler: Approve connection request
router.put('/:connectionId/approve', verifyToken, isWholesaler, async (req, res) => {
  try {
    const connection = await Connection.findById(req.params.connectionId);

    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    if (connection.wholesaler_id.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (connection.status === 'approved') {
      return res.status(400).json({ error: 'Connection already approved' });
    }

    connection.status = 'approved';
    await connection.save();

    res.json({
      message: 'Connection approved successfully',
      connection
    });
  } catch (error) {
    console.error('Approve connection error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Wholesaler: Reject connection request
router.put('/:connectionId/reject', verifyToken, isWholesaler, async (req, res) => {
  try {
    const connection = await Connection.findById(req.params.connectionId);

    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    if (connection.wholesaler_id.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    connection.status = 'rejected';
    await connection.save();

    res.json({
      message: 'Connection rejected',
      connection
    });
  } catch (error) {
    console.error('Reject connection error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Both: Delete/Remove connection
router.delete('/:connectionId', verifyToken, async (req, res) => {
  try {
    const connection = await Connection.findById(req.params.connectionId);

    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    // Check if user is authorized (either wholesaler, retailer, or salesman with permission)
    let isAuthorized = 
      connection.wholesaler_id.toString() === req.user.userId ||
      connection.retailer_id.toString() === req.user.userId;

    // Check if salesman with delete permission
    if (!isAuthorized && req.user.userType === 'salesman') {
      const Salesman = require('../models/Salesman');
      const salesman = await Salesman.findById(req.user.userId);
      
      if (salesman && 
          salesman.wholesaler_id.toString() === connection.wholesaler_id.toString() &&
          salesman.permissions?.can_delete_retailers) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return res.status(403).json({ error: 'You do not have permission to delete this connection' });
    }

    await Connection.findByIdAndDelete(req.params.connectionId);

    res.json({ message: 'Connection removed successfully' });
  } catch (error) {
    console.error('Delete connection error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Retailer: Get all wholesalers (for browsing/search)
router.get('/wholesalers/search', verifyToken, isRetailer, async (req, res) => {
  try {
    const { search } = req.query;
    
    let query = {}; // Show all wholesalers, not just verified ones
    
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { business_name: searchRegex },
        { owner_name: searchRegex },
        { city: searchRegex },
        { state: searchRegex }
      ];
    }

    const wholesalers = await Wholesaler.find(query)
      .select('business_name owner_name city state email phone')
      .limit(50)
      .sort({ business_name: 1 });

    // Get existing connections for this retailer
    const connections = await Connection.find({ 
      retailer_id: req.user.userId 
    });

    const connectionMap = {};
    connections.forEach(conn => {
      connectionMap[conn.wholesaler_id.toString()] = conn.status;
    });

    // Add connection status to each wholesaler
    const wholesalersWithStatus = wholesalers.map(w => ({
      ...w.toObject(),
      connectionStatus: connectionMap[w._id.toString()] || 'none'
    }));

    res.json(wholesalersWithStatus);
  } catch (error) {
    console.error('Search wholesalers error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Check connection status between retailer and wholesaler
router.get('/check/:wholesalerId', verifyToken, isRetailer, async (req, res) => {
  try {
    const connection = await Connection.findOne({
      wholesaler_id: req.params.wholesalerId,
      retailer_id: req.user.userId
    });

    if (!connection) {
      return res.json({ status: 'none' });
    }

    res.json({ status: connection.status, connection });
  } catch (error) {
    console.error('Check connection error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
