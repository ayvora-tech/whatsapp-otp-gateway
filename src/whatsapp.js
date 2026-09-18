import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const AUTH_DIR = path.join(__dirname, '..', 'data', 'auth_info');

// Ensure auth directory exists
if (!fs.existsSync(AUTH_DIR)) {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
}

class WhatsAppService {
  constructor() {
    this.sock = null;
    this.status = 'disconnected'; // 'disconnected' | 'connecting' | 'qr_ready' | 'connected'
    this.qrDataUrl = null;
    this.qrRaw = null;
    this.user = null;
    this.logs = [];
    this.stats = {
      totalSent: 0,
      totalFailed: 0,
      connectedAt: null,
      startedAt: new Date().toISOString(),
    };
    this.reconnectAttempts = 0;
    this.logger = pino({ level: 'silent' });
  }

  addLog(type, message, meta = {}) {
    const entry = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      timestamp: new Date().toISOString(),
      type, // 'info' | 'connected' | 'disconnected' | 'qr' | 'sent' | 'error'
      message,
      meta,
    };
    this.logs.unshift(entry);
    if (this.logs.length > 100) {
      this.logs.pop();
    }
  }

  async init() {
    await this.connectToWhatsApp();
  }

  async connectToWhatsApp() {
    try {
      this.status = 'connecting';
      this.addLog('info', 'Connecting to WhatsApp Multi-Device network...');

      const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
      const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1015901307] }));

      this.sock = makeWASocket({
        version,
        logger: this.logger,
        printQRInTerminal: false, // We will handle printing ourselves cleanly
        auth: state,
        browser: ['WhatsApp OTP Gateway', 'Chrome', '1.0.0'],
        syncFullHistory: false,
        markOnlineOnConnect: true,
      });

      // Bind credential saving
      this.sock.ev.on('creds.update', saveCreds);

      // Handle connection updates
      this.sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          this.status = 'qr_ready';
          this.qrRaw = qr;
          try {
            this.qrDataUrl = await qrcode.toDataURL(qr, {
              margin: 2,
              scale: 8,
              color: { dark: '#000000', light: '#ffffff' },
            });
            // Also print terminal QR code
            console.log('\n================== SCAN WHATSAPP QR CODE ==================');
            const asciiQr = await qrcode.toString(qr, { type: 'terminal', small: true });
            console.log(asciiQr);
            console.log('Open WhatsApp > Linked Devices > Link a Device & scan the QR above');
            console.log('Or view the QR on the web dashboard at http://localhost:3000');
            console.log('===========================================================\n');
            this.addLog('qr', 'New QR Code generated. Ready for scanning.');
          } catch (qrErr) {
            console.error('Failed to generate QR Data URL:', qrErr);
          }
        }

        if (connection === 'close') {
          const statusCode = lastDisconnect?.error?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

          this.status = 'disconnected';
          this.qrDataUrl = null;
          this.qrRaw = null;
          this.user = null;

          console.log(`[WhatsApp] Connection closed. Status code: ${statusCode}. Reconnect: ${shouldReconnect}`);
          this.addLog('disconnected', `Disconnected (code ${statusCode || 'unknown'}).`);

          if (statusCode === DisconnectReason.loggedOut) {
            this.addLog('info', 'Session logged out. Clearing stored credentials...');
            try {
              fs.rmSync(AUTH_DIR, { recursive: true, force: true });
              fs.mkdirSync(AUTH_DIR, { recursive: true });
            } catch (rmErr) {
              console.error('Failed to clear auth dir:', rmErr);
            }
            // Wait 2s and start fresh to generate a new QR
            setTimeout(() => this.connectToWhatsApp(), 2000);
          } else if (shouldReconnect) {
            this.reconnectAttempts++;
            const delay = Math.min(30000, 3000 * Math.pow(1.5, Math.min(this.reconnectAttempts, 5)));
            console.log(`[WhatsApp] Reconnecting in ${(delay / 1000).toFixed(1)}s...`);
            setTimeout(() => this.connectToWhatsApp(), delay);
          }
        } else if (connection === 'open') {
          this.status = 'connected';
          this.reconnectAttempts = 0;
          this.qrDataUrl = null;
          this.qrRaw = null;
          this.stats.connectedAt = new Date().toISOString();

          const rawId = this.sock?.user?.id || '';
          const phone = rawId.split(':')[0] || rawId.split('@')[0];
          const name = this.sock?.user?.name || 'WhatsApp Account';

          this.user = {
            id: rawId,
            phone,
            name,
          };

          console.log(`\n✅ [WhatsApp] Connected successfully! Logged in as: ${name} (+${phone})\n`);
          this.addLog('connected', `Connected as ${name} (+${phone})`, { phone, name });
        }
      });
    } catch (err) {
      console.error('[WhatsApp] Initialization error:', err);
      this.status = 'disconnected';
      this.addLog('error', `Initialization error: ${err.message}`);
      setTimeout(() => this.connectToWhatsApp(), 5000);
    }
  }

  async sendTextMessage(toPhone, message) {
    if (this.status !== 'connected' || !this.sock) {
      throw new Error('WhatsApp is not connected. Please scan the QR code first.');
    }

    if (!message || !message.trim()) {
      throw new Error('Message text cannot be empty.');
    }

    // Clean phone number: strip non-digits
    const cleanPhone = toPhone.toString().replace(/\D/g, '');
    if (cleanPhone.length < 8) {
      throw new Error('Invalid phone number length.');
    }

    const jid = `${cleanPhone}@s.whatsapp.net`;

    try {
      const result = await this.sock.sendMessage(jid, { text: message });
      this.stats.totalSent++;
      this.addLog('sent', `Sent message to +${cleanPhone}`, {
        phone: cleanPhone,
        preview: message.substring(0, 40) + (message.length > 40 ? '...' : ''),
      });

      return {
        success: true,
        recipient: cleanPhone,
        messageId: result?.key?.id || null,
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      this.stats.totalFailed++;
      this.addLog('error', `Failed to send to +${cleanPhone}: ${err.message}`, { phone: cleanPhone });
      throw new Error(`Failed to send WhatsApp message: ${err.message}`);
    }
  }

  async logout() {
    this.addLog('info', 'User initiated logout.');
    try {
      if (this.sock) {
        await this.sock.logout();
      }
    } catch (e) {
      // Ignore logout errors
    }

    try {
      fs.rmSync(AUTH_DIR, { recursive: true, force: true });
      fs.mkdirSync(AUTH_DIR, { recursive: true });
    } catch (rmErr) {
      console.error('Failed to clear auth dir on logout:', rmErr);
    }

    this.status = 'disconnected';
    this.user = null;
    this.qrDataUrl = null;
    this.qrRaw = null;

    setTimeout(() => this.connectToWhatsApp(), 1500);
    return { success: true, message: 'Logged out successfully. Generating new QR code...' };
  }

  getStatus() {
    return {
      status: this.status,
      user: this.user,
      qrCode: this.qrDataUrl,
      stats: {
        ...this.stats,
        uptimeSeconds: Math.floor(process.uptime()),
      },
      hasQr: !!this.qrDataUrl,
    };
  }

  getRecentLogs() {
    return this.logs;
  }
}

export const whatsappService = new WhatsAppService();
