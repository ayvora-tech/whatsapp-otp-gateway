# 📱 Complete Guide: Run 24/7 On Your Android Phone (100% Free Forever)

This guide shows you how to turn your Android phone into the **complete server**. Your phone will:
1. **Host the Node.js Server & REST API** 24/7.
2. **Maintain the WhatsApp Gateway** connection.
3. **Dispatch SIM Card SMS** automatically.
4. **Sync all logs & API keys with your Supabase database**.
5. **Give you a free public HTTPS link** (via Cloudflare Tunnel) so your websites and apps can call it from anywhere in the world.

> 💡 **You can turn off your Mac completely!** No credit card, no cloud hosting fees, 100% free forever.

---

## 📋 Overview of What You Need

1. An **Android Phone** (connected to Wi-Fi or 4G data, plugged into a charger).
2. An active **SIM card** with SMS balance in the phone.
3. **Termux** (free Linux terminal for Android).

---

## 🚀 Step 1: Install Termux & Termux:API on Your Phone

> ⚠️ **Important**: Do **NOT** download Termux from Google Play Store (the Play Store version is outdated and deprecated). Always install from **F-Droid**.

1. On your phone's browser, open:
   * **Termux**: [f-droid.org/packages/com.termux](https://f-droid.org/packages/com.termux/) &rarr; scroll down to *Download APK* and install.
   * **Termux:API**: [f-droid.org/packages/com.termux.api](https://f-droid.org/packages/com.termux.api/) &rarr; scroll down to *Download APK* and install (this allows Termux to send SMS via your SIM card).

2. **Grant Permissions**:
   * On your phone, go to **Settings** &rarr; **Apps** &rarr; **Termux:API** &rarr; **Permissions** &rarr; Enable **SMS** (Allow).
   * Go to **Settings** &rarr; **Apps** &rarr; **Termux** &rarr; **Battery** &rarr; Choose **Unrestricted** (so Android never sleeps the app).

---

## 📦 Step 2: Download Your Project in Termux

1. Open the **Termux** app on your phone.
2. Type these commands (press Enter after each):

```bash
pkg update -y
pkg install -y git
```

3. Clone your repository:
```bash
git clone https://github.com/ayvora-tech/whatsapp-otp-gateway.git
cd whatsapp-otp-gateway
```

*(Alternatively, you can connect your phone to your Mac via USB and copy the folder directly into your phone's storage).*

---

## ⚡ Step 3: Run the 1-Click Automated Setup

Inside the `whatsapp-otp-gateway` folder in Termux, run:

```bash
bash setup-termux.sh
```

This script will automatically:
* Enable **CPU Wake Lock** (keeps the server running even when the phone screen is locked/black).
* Install Node.js LTS, Git, and Termux:API tools.
* Install all project dependencies (`npm install`).
* Install **Cloudflare Tunnel (`cloudflared`)** for a free public HTTPS address.

---

## 🌐 Step 4: Start the Server with Free Public HTTPS Tunnel

Run:

```bash
bash start-tunnel.sh
```

You will see:
1. The Node.js server starts up.
2. The terminal prints your **WhatsApp QR Code** (or you can open it in your browser).
3. Cloudflare Tunnel generates your **Public HTTPS URL**, like:
   ```
   https://random-words-1234.trycloudflare.com
   ```

---

## 📲 Step 5: Link WhatsApp Once

1. Open your browser on your phone (or any computer) and go to:
   * `http://localhost:3000` (on the phone), OR
   * Your public Cloudflare URL (e.g. `https://xxxx.trycloudflare.com`).
2. Open **WhatsApp** on your primary phone &rarr; **Linked Devices** &rarr; **Link a Device** &rarr; Scan the QR code.
3. **Connected!** The session is saved on your phone and automatically reconnects if the network drops.

---

## 🧪 Step 6: Test Sending an OTP

Now you can test sending an OTP:

### Test via Dashboard:
* Open the web dashboard &rarr; **Live OTP Sandbox**.
* Select **SMS (Phone SIM)** or **WhatsApp**.
* Enter your phone number &rarr; Click Send!

### Test via REST API (from your website or external server):
```bash
curl -X POST "https://your-tunnel-url.trycloudflare.com/api/otp/send" \
  -H "Content-Type: application/json" \
  -H "x-api-key: your_api_key_here" \
  -d '{
    "phone": "+1234567890",
    "channel": "sms",
    "length": 6,
    "expiryMinutes": 5
  }'
```

---

## 🔋 How to Keep It Running 24/7 Permanently

1. **Keep Phone Plugged into Charger**: Leave the phone in a safe place connected to power.
2. **Screen Off is OK**: Thanks to `termux-wake-lock`, the phone keeps running even when the screen is dark and locked.
3. **Turn Off Your Mac**: You no longer need your Mac running at all. Everything runs autonomously on the phone!
4. **Data Sync**: All your OTP logs and API keys sync to your **Supabase Cloud Database** in real-time.
