import crypto from 'crypto';

class OtpService {
  constructor() {
    // Map of normalizedPhone -> { codeHash, salt, expiresAt, attempts, createdAt }
    this.otpStore = new Map();
    // Map of normalizedPhone -> Array of request timestamps for rate limiting
    this.rateLimitStore = new Map();

    // Clean up expired items every minute
    setInterval(() => this.cleanupExpired(), 60 * 1000);
  }

  normalizePhone(rawPhone) {
    if (!rawPhone || typeof rawPhone !== 'string') return '';
    // Strip everything except digits
    return rawPhone.replace(/\D/g, '');
  }

  hashOtp(code, salt) {
    return crypto.createHmac('sha256', salt).update(code.toString()).digest('hex');
  }

  checkRateLimit(phone, maxPerWindow = 4, windowMinutes = 10) {
    const now = Date.now();
    const windowMs = windowMinutes * 60 * 1000;
    const history = this.rateLimitStore.get(phone) || [];

    // Filter to requests within current sliding window
    const recent = history.filter(ts => now - ts < windowMs);
    if (recent.length >= maxPerWindow) {
      const oldest = recent[0];
      const waitMinutes = Math.ceil((windowMs - (now - oldest)) / 60000);
      return {
        allowed: false,
        waitMinutes,
      };
    }

    recent.push(now);
    this.rateLimitStore.set(phone, recent);
    return { allowed: true };
  }

  generateNumericOtp(length = 6) {
    const len = Math.max(4, Math.min(8, Number(length) || 6));
    const min = Math.pow(10, len - 1);
    const max = Math.pow(10, len) - 1;
    return crypto.randomInt(min, max + 1).toString();
  }

  createOtp({ phone, length = 6, expiryMinutes = 5 }) {
    const normalizedPhone = this.normalizePhone(phone);
    if (!normalizedPhone || normalizedPhone.length < 8) {
      throw new Error('Invalid phone number. Please provide a full phone number including country code (e.g. +1234567890).');
    }

    // Rate limit check
    const rateCheck = this.checkRateLimit(normalizedPhone);
    if (!rateCheck.allowed) {
      throw new Error(`Too many OTP requests for this phone number. Please try again in ${rateCheck.waitMinutes} minute(s).`);
    }

    const code = this.generateNumericOtp(length);
    const salt = crypto.randomBytes(16).toString('hex');
    const codeHash = this.hashOtp(code, salt);
    const expiryMs = Math.max(1, Math.min(60, Number(expiryMinutes) || 5)) * 60 * 1000;
    const expiresAt = Date.now() + expiryMs;

    this.otpStore.set(normalizedPhone, {
      codeHash,
      salt,
      expiresAt,
      attempts: 0,
      createdAt: Date.now(),
    });

    return {
      phone: normalizedPhone,
      code,
      expiresInSeconds: Math.floor(expiryMs / 1000),
      expiresAt: new Date(expiresAt).toISOString(),
    };
  }

  verifyOtp({ phone, code }) {
    const normalizedPhone = this.normalizePhone(phone);
    if (!normalizedPhone) {
      return { success: false, valid: false, error: 'Phone number is required.' };
    }

    if (!code) {
      return { success: false, valid: false, error: 'Verification code is required.' };
    }

    const cleanCode = code.toString().trim();
    const record = this.otpStore.get(normalizedPhone);

    if (!record) {
      return {
        success: false,
        valid: false,
        error: 'No active OTP found for this phone number or it has already expired. Please request a new one.',
      };
    }

    // Check expiration
    if (Date.now() > record.expiresAt) {
      this.otpStore.delete(normalizedPhone);
      return {
        success: false,
        valid: false,
        error: 'Verification code has expired. Please request a new code.',
      };
    }

    // Check brute-force attempts
    record.attempts += 1;
    if (record.attempts > 5) {
      this.otpStore.delete(normalizedPhone);
      return {
        success: false,
        valid: false,
        error: 'Too many incorrect attempts. For security, this code has been revoked. Please request a new one.',
      };
    }

    // Check hash match
    const computedHash = this.hashOtp(cleanCode, record.salt);
    if (computedHash !== record.codeHash) {
      const remaining = 5 - record.attempts;
      return {
        success: false,
        valid: false,
        error: `Incorrect verification code. ${remaining} attempt(s) remaining.`,
      };
    }

    // Code is valid! Invalidate immediately (single-use OTP)
    this.otpStore.delete(normalizedPhone);

    return {
      success: true,
      valid: true,
      message: 'OTP verified successfully.',
      verifiedAt: new Date().toISOString(),
    };
  }

  getActiveCount() {
    this.cleanupExpired();
    return this.otpStore.size;
  }

  cleanupExpired() {
    const now = Date.now();
    for (const [phone, record] of this.otpStore.entries()) {
      if (now > record.expiresAt) {
        this.otpStore.delete(phone);
      }
    }
  }
}

export const otpService = new OtpService();
