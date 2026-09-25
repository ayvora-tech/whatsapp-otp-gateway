import crypto from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';
import { apiKeyService } from './apiKeyService.js';
import { supabaseService } from './supabaseService.js';

const execAsync = promisify(exec);

class SmsGatewayService {
  constructor() {
    // Map of deviceId -> { ws, info, lastPing, connectedAt, remoteIp }
    this.devices = new Map();
    // Map of messageId -> { resolve, reject, timer, to, message, createdAt }
    this.pendingDispatches = new Map();

    // Statistics
    this.stats = {
      totalSent: 0,
      totalDelivered: 0,
      totalFailed: 0,
    };

    // Activity logs
    this.logs = [];
    this.maxLogs = 100;

    // Termux Native SMS Support
    this.hasTermuxSms = false;
    this.checkTermuxApi();

    // Heartbeat check interval (every 25 seconds)
    setInterval(() => this.cleanupDeadConnections(), 25 * 1000);
  }

  async checkTermuxApi() {
    try {
      const { stdout } = await execAsync('which termux-sms-send');
      if (stdout && stdout.trim().length > 0) {
        this.hasTermuxSms = true;
        this.log('info', '📱 Native Termux SMS detected! Direct SIM card sending is active.');
      }
    } catch (_) {
      this.hasTermuxSms = false;
    }
  }

  log(type, message, details = null) {
    const entry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      type, // 'info' | 'success' | 'warn' | 'error'
      message,
      details,
    };
    this.logs.unshift(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.pop();
    }
    console.log(`[SMS-Gateway] [${type.toUpperCase()}] ${message}`);
  }

  getLogs() {
    return this.logs;
  }

  clearLogs() {
    this.logs = [];
  }

  getStatus() {
    const connectedDevices = [];
    for (const [id, dev] of this.devices.entries()) {
      connectedDevices.push({
        id,
        connectedAt: dev.connectedAt,
        lastPing: dev.lastPing,
        remoteIp: dev.remoteIp,
        info: dev.info || {},
      });
    }

    const isConnected = connectedDevices.length > 0 || this.hasTermuxSms;
    const primaryDevice = connectedDevices.length > 0
      ? connectedDevices[0]
      : (this.hasTermuxSms
          ? { id: 'termux_native', info: { model: 'Android Phone (Termux Native)', carrier: 'SIM Card', battery: 100 } }
          : null);

    return {
      isConnected,
      hasTermuxSms: this.hasTermuxSms,
      deviceCount: connectedDevices.length + (this.hasTermuxSms ? 1 : 0),
      primaryDevice,
      devices: connectedDevices,
      stats: this.stats,
    };
  }

  /**
   * Handle incoming WebSocket connection from Android phone
   */
  handleConnection(ws, req) {
    const remoteIp = req.socket.remoteAddress || 'unknown';
    let authenticatedDeviceId = null;

    // Parse query params (e.g. ?token=wotp_live_...&model=Pixel+8)
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const token = url.searchParams.get('token') || url.searchParams.get('apiKey');

    // Setup initial connection state
    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
      if (authenticatedDeviceId && this.devices.has(authenticatedDeviceId)) {
        this.devices.get(authenticatedDeviceId).lastPing = Date.now();
      }
    });

    ws.on('message', (data) => {
      try {
        const payload = JSON.parse(data.toString());
        this.handleDevicePayload(ws, payload, remoteIp, (devId) => {
          authenticatedDeviceId = devId;
        });
      } catch (err) {
        console.error('[SMS-Gateway] Failed to parse device message:', err.message);
      }
    });

    ws.on('close', () => {
      if (authenticatedDeviceId && this.devices.has(authenticatedDeviceId)) {
        const dev = this.devices.get(authenticatedDeviceId);
        this.log('warn', `Device disconnected: ${dev.info?.model || authenticatedDeviceId}`);
        this.devices.delete(authenticatedDeviceId);
      }
    });

    ws.on('error', (err) => {
      console.error('[SMS-Gateway] WebSocket error:', err.message);
    });

    // If token passed in query string, attempt immediate authentication
    if (token) {
      if (apiKeyService.validateKey(token)) {
        const devId = `dev_${crypto.randomBytes(6).toString('hex')}`;
        authenticatedDeviceId = devId;
        this.devices.set(devId, {
          ws,
          info: {
            model: url.searchParams.get('model') || 'Android Device',
            battery: url.searchParams.get('battery') || null,
            carrier: url.searchParams.get('carrier') || 'Unknown SIM',
          },
          lastPing: Date.now(),
          connectedAt: new Date().toISOString(),
          remoteIp,
        });

        ws.send(JSON.stringify({
          type: 'AUTH_SUCCESS',
          deviceId: devId,
          message: 'Android SMS Gateway authenticated successfully.',
        }));

        this.log('success', `Android SMS Gateway connected & authorized (${devId})`);
      } else {
        ws.send(JSON.stringify({
          type: 'AUTH_FAILED',
          message: 'Invalid API key or token.',
        }));
        ws.close(4001, 'Unauthorized');
      }
    }
  }

  /**
   * Process incoming messages from Android app
   */
  handleDevicePayload(ws, payload, remoteIp, setDevId) {
    const { type } = payload;

    switch (type) {
      case 'AUTH': {
        const { apiKey, deviceId = `dev_${crypto.randomBytes(6).toString('hex')}`, info = {} } = payload;

        if (!apiKeyService.validateKey(apiKey)) {
          ws.send(JSON.stringify({
            type: 'AUTH_FAILED',
            message: 'Invalid API key. Check dashboard keys.',
          }));
          ws.close(4001, 'Unauthorized');
          return;
        }

        setDevId(deviceId);
        this.devices.set(deviceId, {
          ws,
          info: {
            model: info.model || 'Android Device',
            manufacturer: info.manufacturer || '',
            androidVersion: info.androidVersion || '',
            battery: info.battery !== undefined ? info.battery : null,
            isCharging: !!info.isCharging,
            carrier: info.carrier || 'Cellular SIM',
            signalLevel: info.signalLevel || null,
          },
          lastPing: Date.now(),
          connectedAt: new Date().toISOString(),
          remoteIp,
        });

        ws.send(JSON.stringify({
          type: 'AUTH_SUCCESS',
          deviceId,
          serverTime: Date.now(),
          message: 'Connected to Fulla SMS Gateway.',
        }));

        this.log('success', `Device linked: ${info.model || 'Android Phone'} (Carrier: ${info.carrier || 'SIM'})`);
        supabaseService.updateDeviceStatus({ id: deviceId, ...info }).catch(() => {});
        break;
      }

      case 'HEARTBEAT': {
        const { deviceId, info = {} } = payload;
        if (deviceId && this.devices.has(deviceId)) {
          const dev = this.devices.get(deviceId);
          dev.lastPing = Date.now();
          // Update dynamic status like battery
          if (info.battery !== undefined) dev.info.battery = info.battery;
          if (info.isCharging !== undefined) dev.info.isCharging = info.isCharging;
          if (info.carrier) dev.info.carrier = info.carrier;
          if (info.signalLevel !== undefined) dev.info.signalLevel = info.signalLevel;

          supabaseService.updateDeviceStatus({ id: deviceId, ...dev.info }).catch(() => {});
          ws.send(JSON.stringify({ type: 'HEARTBEAT_ACK', timestamp: Date.now() }));
        }
        break;
      }

      case 'SMS_STATUS': {
        const { id, status, error } = payload;
        if (id && this.pendingDispatches.has(id)) {
          const pending = this.pendingDispatches.get(id);
          clearTimeout(pending.timer);
          this.pendingDispatches.delete(id);

          // Log to Supabase
          supabaseService.logSmsEvent({
            messageId: id,
            to: pending.to,
            status,
            deviceModel: this.devices.get(setDevId)?.info?.model,
            carrier: this.devices.get(setDevId)?.info?.carrier,
            error,
          }).catch(() => {});

          if (status === 'SENT' || status === 'DELIVERED') {
            this.stats.totalSent += 1;
            this.stats.totalDelivered += 1;
            this.log('success', `SMS delivered to ${pending.to} via Android phone`);
            pending.resolve({
              success: true,
              id,
              status: 'SENT',
              deliveredAt: new Date().toISOString(),
            });
          } else {
            this.stats.totalFailed += 1;
            const errMsg = error || 'Failed to dispatch SMS from device.';
            this.log('error', `SMS failed to ${pending.to}: ${errMsg}`);
            pending.reject(new Error(errMsg));
          }
        }
        break;
      }

      default:
        console.log('[SMS-Gateway] Unknown payload type:', type);
    }
  }

  /**
   * Dispatch an SMS message through the connected Android phone
   */
  async sendSms(to, text, timeoutMs = 25000) {
    if (this.devices.size === 0) {
      if (this.hasTermuxSms) {
        const messageId = `sms_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
        this.log('info', `Dispatching SMS via native Termux API to ${to}...`);
        try {
          // Escape quotes in message text
          const safeText = text.replace(/"/g, '\\"').replace(/\$/g, '\\$');
          await execAsync(`termux-sms-send -n "${to}" "${safeText}"`);
          this.stats.totalSent += 1;
          this.stats.totalDelivered += 1;
          this.log('success', `SMS sent successfully via Termux native SIM to ${to}`);
          supabaseService.logSmsEvent({
            messageId,
            to,
            status: 'SENT',
            deviceModel: 'Android Phone (Termux Native)',
            carrier: 'SIM Card',
          }).catch(() => {});
          return {
            success: true,
            id: messageId,
            status: 'SENT',
            deliveredAt: new Date().toISOString(),
          };
        } catch (tErr) {
          this.stats.totalFailed += 1;
          this.log('error', `Termux native SMS failed: ${tErr.message}`);
          throw new Error(`Failed to send SMS via Termux: ${tErr.message}`);
        }
      }

      throw new Error('No Android phone is connected as an SMS Gateway. Please open the Fulla SMS Gateway app on your phone.');
    }

    // Pick first active device
    const [deviceId, device] = this.devices.entries().next().value;
    if (!device.ws || device.ws.readyState !== 1) { // 1 = OPEN
      this.devices.delete(deviceId);
      throw new Error('Connected phone socket is not open. Please reconnect your phone.');
    }

    const messageId = `sms_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pendingDispatches.has(messageId)) {
          this.pendingDispatches.delete(messageId);
          this.stats.totalFailed += 1;
          this.log('error', `SMS dispatch timed out to ${to}`);
          reject(new Error('SMS dispatch timed out. The phone took too long to acknowledge carrier transmission.'));
        }
      }, timeoutMs);

      this.pendingDispatches.set(messageId, {
        resolve,
        reject,
        timer,
        to,
        message: text,
        createdAt: Date.now(),
      });

      const payload = {
        action: 'SEND_SMS',
        type: 'SEND_SMS',
        id: messageId,
        to,
        message: text,
        timestamp: Date.now(),
      };

      try {
        device.ws.send(JSON.stringify(payload));
        this.log('info', `Dispatched SMS request ${messageId} to ${device.info.model || 'Android phone'}`);
      } catch (err) {
        clearTimeout(timer);
        this.pendingDispatches.delete(messageId);
        reject(new Error(`Failed to transmit SMS to phone: ${err.message}`));
      }
    });
  }

  cleanupDeadConnections() {
    const now = Date.now();
    for (const [id, dev] of this.devices.entries()) {
      // If no ping in 60s, terminate socket
      if (now - dev.lastPing > 60 * 1000) {
        this.log('warn', `Device ${id} timed out. Terminating.`);
        try {
          dev.ws.terminate();
        } catch (_) {}
        this.devices.delete(id);
      } else {
        // Send WebSocket ping frame
        try {
          if (dev.ws.readyState === 1) {
            dev.ws.ping();
          }
        } catch (_) {}
      }
    }
  }
}

export const smsGatewayService = new SmsGatewayService();
