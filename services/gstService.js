const axios = require('axios');

// GST Verification Service
const verifyGST = async (gstNumber) => {
  try {
    // Using free GST verification API (replace with your preferred service)
    const response = await axios.get(
      `https://sheet.gstincheck.co.in/check/${gstNumber}`
    );

    if (response.data && response.data.flag) {
      return {
        valid: true,
        data: response.data.data
      };
    }

    return { valid: false };
  } catch (error) {
    console.error('GST verification error:', error.message);
    // Return as valid if API fails (don't block registration)
    return { valid: true, error: 'Verification service unavailable' };
  }
};

module.exports = { verifyGST };
