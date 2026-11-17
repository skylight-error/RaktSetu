const { db } = require('../db/database');

// Ensure sms_logs table exists
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sms_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      donor_id INTEGER,
      application_id INTEGER,
      recipient TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'APPOINTMENT',
      provider TEXT NOT NULL,
      status TEXT NOT NULL,
      response_data TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
} catch (e) {
  // Table already exists or migration handled
}

/**
 * Clean & normalize phone number for Indian SMS gateways (Fast2SMS / MSG91)
 * Strips formatting to provide clean 10-digit number (e.g. 9876543210)
 */
function normalizeIndianPhone(phone) {
  if (!phone) return null;
  const digits = phone.toString().replace(/\D/g, '');
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length > 10) return digits.slice(-10);
  return digits;
}

/**
 * Send SMS using Fast2SMS, MSG91, or resilient simulated delivery
 * @param {Object} options
 * @param {string} options.to - Recipient phone number (+91 98765 43210 or 9876543210)
 * @param {string} options.message - Text message content
 * @param {string} [options.type='APPOINTMENT'] - SMS type (e.g. APPOINTMENT, APPROVAL, URGENT)
 * @param {number} [options.donorId] - Linked donor ID
 * @param {number} [options.applicationId] - Linked application ID
 */
async function sendSMS({ to, message, type = 'APPOINTMENT', donorId = null, applicationId = null }) {
  const cleanPhone = normalizeIndianPhone(to);
  if (!cleanPhone || cleanPhone.length < 10) {
    console.warn(`[SMS Service] Invalid recipient phone number: ${to}`);
    return {
      success: false,
      error: 'Invalid recipient phone number. Indian 10-digit mobile required.',
      simulated: true
    };
  }

  const fast2smsKey = process.env.FAST2SMS_API_KEY;
  const msg91AuthKey = process.env.MSG91_AUTH_KEY;
  const msg91SenderId = process.env.MSG91_SENDER_ID || 'RAKTST';

  // 1. Check if Fast2SMS API key is provided
  if (fast2smsKey && fast2smsKey.trim() !== '') {
    try {
      // Fast2SMS Quick Transactional SMS Route (route 'q')
      const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
        method: 'POST',
        headers: {
          'authorization': fast2smsKey.trim(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          route: 'q',
          message: message,
          language: 'english',
          flash: 0,
          numbers: cleanPhone
        })
      });

      const resData = await response.json();
      const isSuccess = resData.return === true || response.ok;

      db.prepare(`
        INSERT INTO sms_logs (donor_id, application_id, recipient, message, type, provider, status, response_data)
        VALUES (?, ?, ?, ?, ?, 'FAST2SMS', ?, ?)
      `).run(
        donorId,
        applicationId,
        `+91 ${cleanPhone}`,
        message,
        type,
        isSuccess ? 'DELIVERED' : 'FAILED',
        JSON.stringify(resData)
      );

      console.log(`[Fast2SMS] Dispatched to +91 ${cleanPhone}: Status=${isSuccess ? 'DELIVERED' : 'FAILED'}`);
      return {
        success: isSuccess,
        provider: 'FAST2SMS',
        recipient: `+91 ${cleanPhone}`,
        response: resData
      };
    } catch (err) {
      console.error('[Fast2SMS Error]', err.message);
      // Fallback log
      db.prepare(`
        INSERT INTO sms_logs (donor_id, application_id, recipient, message, type, provider, status, response_data)
        VALUES (?, ?, ?, ?, ?, 'FAST2SMS', 'ERROR', ?)
      `).run(donorId, applicationId, `+91 ${cleanPhone}`, message, type, err.message);
    }
  }

  // 2. Check if MSG91 API key is provided
  if (msg91AuthKey && msg91AuthKey.trim() !== '') {
    try {
      const response = await fetch('https://api.msg91.com/api/v2/sendsms', {
        method: 'POST',
        headers: {
          'authkey': msg91AuthKey.trim(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sender: msg91SenderId,
          route: '4',
          country: '91',
          sms: [
            {
              message: message,
              to: [cleanPhone]
            }
          ]
        })
      });

      const resData = await response.json();
      const isSuccess = response.ok && resData.type !== 'error';

      db.prepare(`
        INSERT INTO sms_logs (donor_id, application_id, recipient, message, type, provider, status, response_data)
        VALUES (?, ?, ?, ?, ?, 'MSG91', ?, ?)
      `).run(
        donorId,
        applicationId,
        `+91 ${cleanPhone}`,
        message,
        type,
        isSuccess ? 'DELIVERED' : 'FAILED',
        JSON.stringify(resData)
      );

      console.log(`[MSG91] Dispatched to +91 ${cleanPhone}: Status=${isSuccess ? 'DELIVERED' : 'FAILED'}`);
      return {
        success: isSuccess,
        provider: 'MSG91',
        recipient: `+91 ${cleanPhone}`,
        response: resData
      };
    } catch (err) {
      console.error('[MSG91 Error]', err.message);
      db.prepare(`
        INSERT INTO sms_logs (donor_id, application_id, recipient, message, type, provider, status, response_data)
        VALUES (?, ?, ?, ?, ?, 'MSG91', 'ERROR', ?)
      `).run(donorId, applicationId, `+91 ${cleanPhone}`, message, type, err.message);
    }
  }

  // 3. Fallback to Simulated SMS Delivery Mode (when API keys are not yet set)
  // Records the full SMS into SQLite sms_logs & prints clear console banner
  db.prepare(`
    INSERT INTO sms_logs (donor_id, application_id, recipient, message, type, provider, status, response_data)
    VALUES (?, ?, ?, ?, ?, 'FAST2SMS_SIMULATED', 'DELIVERED_SIMULATED', ?)
  `).run(
    donorId,
    applicationId,
    `+91 ${cleanPhone}`,
    message,
    type,
    JSON.stringify({ note: 'Simulated delivery. Set FAST2SMS_API_KEY or MSG91_AUTH_KEY in environment for live carrier SMS.' })
  );

  console.log('================================================================');
  console.log('📱 [RAKTSETU SMS GATEWAY - FAST2SMS/MSG91 SIMULATED DISPATCH]');
  console.log(`   To: +91 ${cleanPhone}`);
  console.log(`   Type: ${type}`);
  console.log(`   Message:\n   "${message}"`);
  console.log('   Status: DELIVERED (Simulated)');
  console.log('   ℹ️ Add FAST2SMS_API_KEY on Render for live telecom dispatch.');
  console.log('================================================================');

  return {
    success: true,
    simulated: true,
    provider: 'FAST2SMS_SIMULATED',
    recipient: `+91 ${cleanPhone}`,
    message
  };
}

/**
 * Format screening appointment SMS for donors
 */
function formatAppointmentSMS({ donorName, hospitalName, date, time, instructions, hospitalPhone, hospitalAddress }) {
  let text = `RaktSetu: Hi ${donorName || 'Donor'}, your blood donor screening is scheduled at ${hospitalName} on ${date} at ${time}.`;
  if (hospitalAddress) {
    text += ` Address: ${hospitalAddress}.`;
  }
  if (instructions) {
    text += ` Note: ${instructions}.`;
  }
  if (hospitalPhone) {
    text += ` Contact: ${hospitalPhone}.`;
  }
  text += ' Please carry government photo ID. Thank you for your commitment to saving lives!';
  return text;
}

/**
 * Get recent SMS logs (for auditing in hospital portal)
 */
function getRecentSMSLogs(limit = 20) {
  return db.prepare(`
    SELECT * FROM sms_logs
    ORDER BY id DESC
    LIMIT ?
  `).all(limit);
}

module.exports = {
  sendSMS,
  normalizeIndianPhone,
  formatAppointmentSMS,
  getRecentSMSLogs
};
