const express = require('express');
const router = express.Router();
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const GST_API_URL = 'https://gst-verification.p.rapidapi.com/v3/tasks/sync/verify_with_source/ind_gst_certificate';
const RAPIDAPI_KEY = 'f5c6d3af1amsh2b837a1bf587158p18e808jsn5787df1330a4';
const RAPIDAPI_HOST = 'gst-verification.p.rapidapi.com';

// GST Verification API endpoint
router.post('/verify', async (req, res) => {
  try {
    const { gstNumber } = req.body;

    if (!gstNumber) {
      return res.status(400).json({ error: 'GST number is required' });
    }

    // Validate GST format
    const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    if (!gstRegex.test(gstNumber)) {
      return res.status(400).json({ 
        isValid: false, 
        error: 'Invalid GST format. Format: 22AAAAA0000A1Z5' 
      });
    }

    const taskId = uuidv4();
    const groupId = uuidv4();

    // Using RapidAPI GST verification
    const response = await axios.post(
      GST_API_URL,
      {
        task_id: taskId,
        group_id: groupId,
        data: { gstin: gstNumber }
      },
      {
        headers: {
          'x-rapidapi-key': RAPIDAPI_KEY,
          'x-rapidapi-host': RAPIDAPI_HOST,
          'Content-Type': 'application/json',
        },
        timeout: 15000
      }
    );

    console.log('GST API Response:', JSON.stringify(response.data, null, 2));

    if (response.data && response.data.result) {
      const result = response.data.result;
      let gstData = result.source_output || result.extraction_output || result;

      // Parse address - include all parts in one line
      let formattedAddress = '';
      let city = '';
      let state = '';
      let pincode = '';

      if (gstData.principal_place_of_business_fields?.principal_place_of_business_address) {
        const addr = gstData.principal_place_of_business_fields.principal_place_of_business_address;
        const addressParts = [
          addr.door_number,
          addr.floor_number,
          addr.building_name,
          addr.building_number,
          addr.street,
          addr.location,
          addr.dst,
          addr.state_name,
          addr.pincode
        ].filter(Boolean);
        formattedAddress = addressParts.join(', ');
        city = addr.dst || addr.location || '';
        state = addr.state_name || '';
        pincode = addr.pincode || '';
      } else if (gstData.address) {
        formattedAddress = gstData.address;
      }

      return res.json({
        isValid: true,
        businessName: gstData.trade_name || gstData.tradeName || gstData.legal_name || gstData.legalName || '',
        ownerName: gstData.legal_name || gstData.legalName || gstData.trade_name || gstData.tradeName || '',
        address: formattedAddress,
        city: city,
        state: state,
        pincode: pincode,
        status: gstData.gstin_status || gstData.status || gstData.sts || 'Active',
        registrationDate: gstData.date_of_registration || gstData.registrationDate || gstData.rgdt || '',
        gstNumber: gstNumber
      });
    } else {
      return res.json({
        isValid: false,
        error: 'GST number not found or invalid'
      });
    }
  } catch (error) {
    console.error('GST verification error:', error.message);
    
    // Return graceful response if API fails
    return res.json({
      isValid: true,
      error: 'GST verification service temporarily unavailable. You can continue with manual entry.',
      businessName: '',
      ownerName: '',
      address: '',
      city: '',
      state: '',
      pincode: ''
    });
  }
});

module.exports = router;
