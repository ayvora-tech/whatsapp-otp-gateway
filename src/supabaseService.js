import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ydwmqvssnisgbtjdkhxi.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_ZirI6TPOYvtIbbuItKZ-BA_zyt4e-zY';

class SupabaseService {
  constructor() {
    this.client = null;
    this.isConnected = false;

    if (SUPABASE_URL && SUPABASE_KEY) {
      try {
        this.client = createClient(SUPABASE_URL, SUPABASE_KEY, {
          auth: { persistSession: false },
        });
        this.isConnected = true;
        console.log(`[Supabase] Initialized client for ${SUPABASE_URL}`);
      } catch (err) {
        console.error('[Supabase] Initialization error:', err.message);
      }
    } else {
      console.warn('[Supabase] Missing SUPABASE_URL or SUPABASE_KEY. Operating in local-only mode.');
    }
  }

  getClient() {
    return this.client;
  }

  /**
   * Log an OTP creation or verification event to Supabase
   */
  async logOtpEvent({ phone, channel = 'whatsapp', code = null, status = 'dispatched', metadata = {} }) {
    if (!this.client) return null;
    try {
      const { data, error } = await this.client.from('otp_logs').insert([
        {
          phone,
          channel,
          code_preview: code ? code.substring(0, 2) + '****' : null,
          status,
          metadata,
          created_at: new Date().toISOString(),
        },
      ]);
      if (error && error.code !== 'PGRST205') { // PGRST205 = table not found yet
        console.warn('[Supabase] Could not log OTP event:', error.message);
      }
      return data;
    } catch (err) {
      // Don't crash main thread if Supabase network drops
      return null;
    }
  }

  /**
   * Log an SMS dispatch event to Supabase
   */
  async logSmsEvent({ messageId, to, status, deviceModel, carrier, error = null }) {
    if (!this.client) return null;
    try {
      const { data, error: sbErr } = await this.client.from('sms_logs').insert([
        {
          message_id: messageId,
          recipient: to,
          status,
          device_model: deviceModel,
          carrier,
          error_message: error,
          created_at: new Date().toISOString(),
        },
      ]);
      if (sbErr && sbErr.code !== 'PGRST205') {
        console.warn('[Supabase] Could not log SMS event:', sbErr.message);
      }
      return data;
    } catch (err) {
      return null;
    }
  }

  /**
   * Sync API keys from Supabase
   */
  async fetchRemoteKeys() {
    if (!this.client) return null;
    try {
      const { data, error } = await this.client.from('api_keys').select('*');
      if (error) {
        if (error.code !== 'PGRST205') {
          console.warn('[Supabase] Failed to fetch api_keys:', error.message);
        }
        return null;
      }
      return data;
    } catch (err) {
      return null;
    }
  }

  /**
   * Save / Upsert an API Key in Supabase
   */
  async upsertApiKey(keyRecord) {
    if (!this.client) return null;
    try {
      const { data, error } = await this.client.from('api_keys').upsert({
        id: keyRecord.id,
        name: keyRecord.name,
        key: keyRecord.key,
        is_active: keyRecord.isActive,
        created_at: keyRecord.createdAt,
        last_used_at: keyRecord.lastUsedAt,
      });
      if (error && error.code !== 'PGRST205') {
        console.warn('[Supabase] Failed to upsert API key:', error.message);
      }
      return data;
    } catch (err) {
      return null;
    }
  }

  /**
   * Record connected device status
   */
  async updateDeviceStatus(deviceInfo) {
    if (!this.client) return null;
    try {
      const { data, error } = await this.client.from('devices').upsert({
        id: deviceInfo.id || 'primary_device',
        model: deviceInfo.model || 'Unknown Android',
        carrier: deviceInfo.carrier || 'SIM',
        battery: deviceInfo.battery,
        is_online: true,
        last_seen: new Date().toISOString(),
      });
      if (error && error.code !== 'PGRST205') {
        // Table not created yet
      }
      return data;
    } catch (err) {
      return null;
    }
  }
}

export const supabaseService = new SupabaseService();
