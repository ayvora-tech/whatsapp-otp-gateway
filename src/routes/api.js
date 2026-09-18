import express from 'express';
import { whatsappService } from '../whatsapp.js';
import { otpService } from '../otpService.js';
import { apiKeyService } from '../apiKeyService.js';

const router = express.Router();

// Apply API key authentication to all /api endpoints
router.use(apiKeyService.middleware());

/**
 * POST /api/otp/send
 * Generate and dispatch an OTP verification code via WhatsApp
 */
router.post('/otp/send', async (req, res) => {
  try {
    const {
      phone,
      length = 6,
      expiryMinutes = 5,
      messageTemplate = '🔐 *Fulla OTP Verification*\n\nYour verification code is:\n*{{code}}*\n\nValid for {{expiry}} minutes. Please do not share this code.',
    } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        error: 'Field "phone" is required (e.g. "+1234567890").',
      });
    }

    if (whatsappService.status !== 'connected') {
      return res.status(503).json({
        success: false,
        error: 'WhatsApp gateway is not connected. Please scan the QR code in the dashboard first.',
      });
    }

    // Generate and store OTP
    const otpData = otpService.createOtp({
      phone,
      length,
      expiryMinutes,
    });

    // Format message text
    const messageText = messageTemplate
      .replace(/\{\{code\}\}/g, otpData.code)
      .replace(/\{\{expiry\}\}/g, expiryMinutes.toString());

    // Dispatch message via WhatsApp
    await whatsappService.sendTextMessage(otpData.phone, messageText);

    return res.status(200).json({
      success: true,
      message: 'OTP sent successfully via WhatsApp.',
      phone: otpData.phone,
      expiresInSeconds: otpData.expiresInSeconds,
      expiresAt: otpData.expiresAt,
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: err.message,
    });
  }
});

/**
 * POST /api/otp/verify
 * Validate an OTP entered by the user
 */
router.post('/otp/verify', (req, res) => {
  try {
    const { phone, code } = req.body;

    if (!phone || !code) {
      return res.status(400).json({
        success: false,
        error: 'Both "phone" and "code" are required.',
      });
    }

    const verification = otpService.verifyOtp({ phone, code });

    if (!verification.success || !verification.valid) {
      return res.status(400).json({
        success: false,
        valid: false,
        error: verification.error,
      });
    }

    return res.status(200).json({
      success: true,
      valid: true,
      message: verification.message,
      verifiedAt: verification.verifiedAt,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

/**
 * POST /api/message/send
 * Send a custom text message via WhatsApp
 */
router.post('/message/send', async (req, res) => {
  try {
    const { phone, message } = req.body;

    if (!phone || !message) {
      return res.status(400).json({
        success: false,
        error: 'Both "phone" and "message" are required.',
      });
    }

    const result = await whatsappService.sendTextMessage(phone, message);

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: err.message,
    });
  }
});

/**
 * GET /api/status
 * Get connection health status
 */
router.get('/status', (req, res) => {
  const status = whatsappService.getStatus();
  return res.status(200).json({
    success: true,
    status: status.status,
    user: status.user,
    stats: status.stats,
  });
});

export default router;
