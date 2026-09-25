import express from 'express';
import { whatsappService } from '../whatsapp.js';
import { otpService } from '../otpService.js';
import { apiKeyService } from '../apiKeyService.js';
import { smsGatewayService } from '../smsGatewayService.js';
import { supabaseService } from '../supabaseService.js';

const router = express.Router();

// Apply API key authentication to all /api endpoints
router.use(apiKeyService.middleware());

/**
 * POST /api/otp/send
 * Generate and dispatch an OTP verification code via WhatsApp, SMS, or Auto-fallback
 */
router.post('/otp/send', async (req, res) => {
  try {
    const {
      phone,
      channel = 'whatsapp', // 'whatsapp' | 'sms' | 'auto'
      length = 6,
      expiryMinutes = 5,
      messageTemplate,
    } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        error: 'Field "phone" is required (e.g. "+1234567890").',
      });
    }

    const selectedChannel = channel.toLowerCase();
    const isWaConnected = whatsappService.status === 'connected';
    const isSmsConnected = smsGatewayService.getStatus().isConnected;

    // Validate connectivity based on chosen channel
    if (selectedChannel === 'whatsapp' && !isWaConnected) {
      return res.status(503).json({
        success: false,
        error: 'WhatsApp gateway is not connected. Please scan the QR code in the dashboard first, or set channel="sms".',
      });
    }

    if (selectedChannel === 'sms' && !isSmsConnected) {
      return res.status(503).json({
        success: false,
        error: 'Android SMS Gateway is not connected. Please open the Fulla SMS Gateway app on your phone, or set channel="whatsapp".',
      });
    }

    if (selectedChannel === 'auto' && !isWaConnected && !isSmsConnected) {
      return res.status(503).json({
        success: false,
        error: 'Neither WhatsApp nor Android SMS Gateway is connected. Please connect at least one channel.',
      });
    }

    // Generate and store OTP
    const otpData = otpService.createOtp({
      phone,
      length,
      expiryMinutes,
    });

    // Determine target channel (for 'auto', prefer WhatsApp if connected, otherwise SMS)
    let actualChannel = selectedChannel;
    if (selectedChannel === 'auto') {
      actualChannel = isWaConnected ? 'whatsapp' : 'sms';
    }

    // Default template for WhatsApp vs clean SMS
    const defaultTemplate = actualChannel === 'whatsapp'
      ? '🔐 *Fulla OTP Verification*\n\nYour verification code is:\n*{{code}}*\n\nValid for {{expiry}} minutes. Please do not share this code.'
      : 'Your verification code is: {{code}}. Valid for {{expiry}} minutes. Do not share this code.';

    const templateToUse = messageTemplate || defaultTemplate;
    const messageText = templateToUse
      .replace(/\{\{code\}\}/g, otpData.code)
      .replace(/\{\{expiry\}\}/g, expiryMinutes.toString());

    // Dispatch message
    if (actualChannel === 'whatsapp') {
      try {
        await whatsappService.sendTextMessage(otpData.phone, messageText);
      } catch (waErr) {
        // If 'auto' was requested and WhatsApp fails, fallback to SMS
        if (selectedChannel === 'auto' && isSmsConnected) {
          console.log(`[OTP] WhatsApp failed, falling back to SMS for +${otpData.phone}`);
          const smsText = `Your verification code is: ${otpData.code}. Valid for ${expiryMinutes} minutes.`;
          await smsGatewayService.sendSms(otpData.phone, smsText);
          actualChannel = 'sms';
        } else {
          throw waErr;
        }
      }
    } else {
      await smsGatewayService.sendSms(otpData.phone, messageText);
    }

    // Log to Supabase Cloud Database asynchronously
    supabaseService.logOtpEvent({
      phone: otpData.phone,
      channel: actualChannel,
      code: otpData.code,
      status: 'dispatched',
      metadata: { expiresInSeconds: otpData.expiresInSeconds },
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      message: `OTP sent successfully via ${actualChannel === 'whatsapp' ? 'WhatsApp' : 'SMS'}.`,
      channel: actualChannel,
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

    // Log verification result to Supabase
    supabaseService.logOtpEvent({
      phone,
      status: verification.valid ? 'verified' : 'failed',
      metadata: { error: verification.error || null },
    }).catch(() => {});

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
 * POST /api/sms/send
 * Dispatch a custom SMS message via connected Android Phone
 */
router.post('/sms/send', async (req, res) => {
  try {
    const { phone, message } = req.body;

    if (!phone || !message) {
      return res.status(400).json({
        success: false,
        error: 'Both "phone" and "message" are required.',
      });
    }

    const cleanPhone = phone.replace(/\D/g, '');
    const result = await smsGatewayService.sendSms(cleanPhone, message);

    return res.status(200).json({
      success: true,
      message: 'SMS dispatched successfully via Android Phone.',
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
 * GET /api/sms/status
 * Get connected Android SMS Gateway device status
 */
router.get('/sms/status', (req, res) => {
  const smsStatus = smsGatewayService.getStatus();
  return res.status(200).json({
    success: true,
    ...smsStatus,
  });
});

/**
 * GET /api/status
 * Get connection health status (WhatsApp + Android SMS)
 */
router.get('/status', (req, res) => {
  const status = whatsappService.getStatus();
  const smsStatus = smsGatewayService.getStatus();
  return res.status(200).json({
    success: true,
    whatsapp: {
      status: status.status,
      user: status.user,
      stats: status.stats,
    },
    sms: {
      isConnected: smsStatus.isConnected,
      deviceCount: smsStatus.deviceCount,
      primaryDevice: smsStatus.primaryDevice,
      stats: smsStatus.stats,
    },
  });
});

export default router;
