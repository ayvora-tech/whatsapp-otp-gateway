import express from 'express';
import { whatsappService } from '../whatsapp.js';
import { otpService } from '../otpService.js';
import { apiKeyService } from '../apiKeyService.js';

const router = express.Router();

// Get live dashboard overview
router.get('/status', (req, res) => {
  const status = whatsappService.getStatus();
  res.json({
    ...status,
    activeOtps: otpService.getActiveCount(),
  });
});

// List API keys
router.get('/keys', (req, res) => {
  res.json({
    keys: apiKeyService.getAllKeys(),
  });
});

// Create new API key
router.post('/keys', (req, res) => {
  const { name = 'External App Key' } = req.body;
  const newKey = apiKeyService.createKey(name);
  res.status(201).json({
    success: true,
    key: newKey,
  });
});

// Delete / Revoke API key
router.delete('/keys/:id', (req, res) => {
  const { id } = req.params;
  const allKeys = apiKeyService.getAllKeys();
  if (allKeys.length <= 1) {
    return res.status(400).json({
      success: false,
      error: 'Cannot delete the only remaining API key. Create a new one first.',
    });
  }
  const deleted = apiKeyService.revokeKey(id);
  res.json({ success: deleted });
});

// Get recent activity logs
router.get('/logs', (req, res) => {
  res.json({
    logs: whatsappService.getRecentLogs(),
  });
});

// Send test OTP directly from dashboard
router.post('/test-otp', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, error: 'Phone number is required.' });
    }

    if (whatsappService.status !== 'connected') {
      return res.status(400).json({
        success: false,
        error: 'WhatsApp is not connected. Please scan the QR code first.',
      });
    }

    const otpData = otpService.createOtp({ phone, length: 6, expiryMinutes: 5 });
    const message = `🔐 *WhatsApp OTP Verification*\n\nYour test verification code is: *${otpData.code}*\n\nValid for 5 minutes. Please do not share this code.`;

    await whatsappService.sendTextMessage(otpData.phone, message);

    res.json({
      success: true,
      message: `Test OTP sent to +${otpData.phone}!`,
      phone: otpData.phone,
      code: otpData.code, // Returned in dashboard test mode for convenience
      expiresInSeconds: otpData.expiresInSeconds,
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Test verify code from dashboard
router.post('/test-verify', (req, res) => {
  const { phone, code } = req.body;
  const result = otpService.verifyOtp({ phone, code });
  if (!result.success || !result.valid) {
    return res.status(400).json(result);
  }
  res.json(result);
});

// Reconnect
router.post('/reconnect', (req, res) => {
  whatsappService.connectToWhatsApp();
  res.json({ success: true, message: 'Reconnection triggered.' });
});

// Log out session
router.post('/logout', async (req, res) => {
  const result = await whatsappService.logout();
  res.json(result);
});

export default router;
