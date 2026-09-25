# 🚀 Fulla OTP Gateway: WhatsApp & Android Phone SMS (100% Free & Self-Hosted)

A lightweight, zero-cost WhatsApp & Android Phone SMS OTP gateway built with **Node.js**, **Express**, and **Baileys Multi-Device**. Designed to run 24/7 on an Oracle Cloud / Azure VM, a VPS, or your local machine with **no Supabase or third-party database needed**.

---

## ✨ Features

- **$0 Cost Forever**: No Twilio, MessageBird, or Meta Cloud API per-message fees.
- **Dual Delivery Channels**:
  - 🟢 **WhatsApp Gateway**: Dispatches rich OTP messages via linked WhatsApp account.
  - 📱 **Android Phone SMS Gateway (Option B)**: Uses a dedicated Android app to turn any spare Android phone into an automated hardware SIM card SMS gateway!
  - 🔀 **Auto Fallback**: Attempts WhatsApp first, then automatically falls back to your phone's SMS if disconnected or undelivered.
- **Self-Contained**: Manages WhatsApp session, Android WebSocket connections, API keys, and OTP expiration locally.
- **REST API Endpoints**:
  - `POST /api/otp/send`: Generates cryptographically secure OTP and sends it via WhatsApp or phone SMS (`channel: "whatsapp" | "sms" | "auto"`).
  - `POST /api/otp/verify`: Validates code, enforces expiration, prevents brute-forcing, and single-use invalidation.
  - `POST /api/sms/send`: Sends custom arbitrary SMS messages via your connected Android phone.
  - `POST /api/message/send`: Sends custom arbitrary text messages via WhatsApp.
  - `GET /api/status`: Returns gateway connection status and stats (WhatsApp + Android phone).
- **Security & Protection**:
  - API Key authentication (`x-api-key`).
  - Rate limiting (max OTPs per phone within a time window).
  - Replay attack protection (one-time code consumption).
  - SHA-256 code hashing with salts.
- **Modern Web Dashboard**:
  - Real-time QR code display for 1-click WhatsApp linking.
  - Live Android Phone status monitor (model, carrier name, battery % ⚡, sent count).
  - 1-Click APK download button for the companion Android app.
  - Interactive live sandbox with channel selector (WhatsApp vs. Phone SMS).
  - API Key generator and copyable code snippets in JavaScript, Python, Node.js, and cURL.
  - Real-time activity and delivery event logs.

---

## 🚀 Quick Start (Local)

### 1. Install dependencies
```bash
npm install
```

### 2. Start the gateway
```bash
npm start
```

### 3. Link your WhatsApp
1. Open your browser to `http://localhost:3000`.
2. Open WhatsApp on your phone &rarr; **Linked Devices** &rarr; **Link a Device**.
3. Scan the QR code displayed on the dashboard or terminal.
4. Your WhatsApp is now connected!

---

## 📡 REST API Reference

All requests must include your API Key in the `x-api-key` header (or `Authorization: Bearer <key>`).

### 1. Send OTP
```http
POST /api/otp/send
Content-Type: application/json
x-api-key: your_api_key_here

{
  "phone": "+1234567890",
  "length": 6,
  "expiryMinutes": 5,
  "messageTemplate": "Your verification code is: *{{code}}*. Valid for {{expiry}} minutes."
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "message": "OTP sent successfully via WhatsApp.",
  "phone": "1234567890",
  "expiresInSeconds": 300,
  "expiresAt": "2026-09-18T19:40:00.000Z"
}
```

---

### 2. Verify OTP
```http
POST /api/otp/verify
Content-Type: application/json
x-api-key: your_api_key_here

{
  "phone": "+1234567890",
  "code": "648291"
}
```

**Response (200 OK - Valid)**:
```json
{
  "success": true,
  "valid": true,
  "message": "OTP verified successfully.",
  "verifiedAt": "2026-09-18T19:37:12.000Z"
}
```

**Response (400 Bad Request - Invalid/Expired)**:
```json
{
  "success": false,
  "valid": false,
  "error": "Incorrect verification code. 4 attempt(s) remaining."
}
```

---

### 3. Send Custom Message
```http
POST /api/message/send
Content-Type: application/json
x-api-key: your_api_key_here

{
  "phone": "+1234567890",
  "message": "Hello from your application!"
}
```

---

## ☁️ 24/7 Cloud Deployment ($0 Cost - Turn Off Your Computer)

You can run this service 24/7 in the cloud with **zero credit card required** and **$0 fees**:

- 🎓 **[DEPLOY_AZURE_GUIDE.md](DEPLOY_AZURE_GUIDE.md)** &rarr; **Recommended for Students** (Microsoft Azure for Students: 100% Free Linux VM, 24/7, No credit card needed).
- ☁️ **[DEPLOY_ORACLE_GUIDE.md](DEPLOY_ORACLE_GUIDE.md)** &rarr; Oracle Cloud Always Free VM Guide.
