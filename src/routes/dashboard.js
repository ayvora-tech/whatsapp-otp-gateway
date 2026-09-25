import express from 'express';
import { whatsappService } from '../whatsapp.js';
import { otpService } from '../otpService.js';
import { apiKeyService } from '../apiKeyService.js';
import { smsGatewayService } from '../smsGatewayService.js';

const router = express.Router();

// Get live dashboard overview
router.get('/status', (req, res) => {
  const status = whatsappService.getStatus();
  const smsStatus = smsGatewayService.getStatus();

  res.json({
    ...status,
    smsGateway: smsStatus,
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

// Get recent activity logs (both WhatsApp and Android SMS)
router.get('/logs', (req, res) => {
  const waLogs = whatsappService.getRecentLogs() || [];
  const smsLogs = smsGatewayService.getLogs() || [];

  // Combine and sort by timestamp desc
  const allLogs = [...waLogs, ...smsLogs].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  ).slice(0, 100);

  res.json({
    logs: allLogs,
  });
});

// Send test OTP directly from dashboard (supports WhatsApp and SMS)
router.post('/test-otp', async (req, res) => {
  try {
    const { phone, channel = 'whatsapp' } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, error: 'Phone number is required.' });
    }

    const selectedChannel = channel.toLowerCase();

    if (selectedChannel === 'whatsapp' && whatsappService.status !== 'connected') {
      return res.status(400).json({
        success: false,
        error: 'WhatsApp is not connected. Please scan the QR code first, or select SMS channel.',
      });
    }

    if (selectedChannel === 'sms' && !smsGatewayService.getStatus().isConnected) {
      return res.status(400).json({
        success: false,
        error: 'Android SMS Gateway is not connected. Please open the Fulla SMS Gateway app on your phone.',
      });
    }

    const otpData = otpService.createOtp({ phone, length: 6, expiryMinutes: 5 });

    if (selectedChannel === 'whatsapp') {
      const message = `🔐 *Fulla OTP Verification*\n\nYour verification code is:\n*${otpData.code}*\n\nValid for 5 minutes. Please do not share this code.`;
      await whatsappService.sendTextMessage(otpData.phone, message);
    } else {
      const message = `Your Fulla verification code is: ${otpData.code}. Valid for 5 minutes. Do not share.`;
      await smsGatewayService.sendSms(otpData.phone, message);
    }

    res.json({
      success: true,
      channel: selectedChannel,
      message: `Test OTP sent to +${otpData.phone} via ${selectedChannel === 'whatsapp' ? 'WhatsApp' : 'SMS'}!`,
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
