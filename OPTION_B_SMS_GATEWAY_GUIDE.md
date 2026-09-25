# 📱 Option B: Dedicated Android SMS Gateway Guide

This project includes a **100% Native Android SMS Gateway** app (`Fulla SMS Gateway`) that turns any Android phone with an active SIM card into an automated hardware SMS gateway for your website and APIs.

---

## 🌟 How It Works

1. **Your Server**: Node.js backend running `whatsapp-otp-gateway` with a persistent WebSocket server on `/ws/sms-device`.
2. **Your Phone**: Runs the lightweight `Fulla SMS Gateway` app in the background as an Android **Foreground Service**.
3. **The Workflow**:
   * A user on your website/app requests an OTP (`POST /api/otp/send` with `channel: "sms"`).
   * Your server transmits the SMS job over a high-speed WebSocket connection to the phone (< 50ms latency).
   * The phone invokes Android's native `SmsManager` to dispatch the SMS directly from your SIM card.
   * The phone reports `status: "SENT"` back to the server.

---

## 🚀 Step 1: Install the Android App on Your Phone

The APK has already been compiled and placed inside your server's public downloads directory:
* **Direct Download File**: `public/downloads/fulla-sms-gateway.apk`
* **Download via Browser**: Open your dashboard (`http://localhost:3000` or your server's IP) on your phone and tap **"Download Android App (.APK)"**.

### If installing via USB / ADB:
```bash
adb install public/downloads/fulla-sms-gateway.apk
```

---

## ⚙️ Step 2: Configure & Connect the App

1. Open **Fulla SMS Gateway** on your Android phone.
2. Grant the required permissions when prompted:
   * **Send and view SMS messages**
   * **Phone state (to read SIM carrier)**
   * **Notifications (to keep background service alive)**
3. In the connection settings:
   * **Server URL**: Enter your server address:
     * If testing locally on the same Wi-Fi: `http://192.168.x.x:3000`
     * If running in production / cloud: `https://your-domain.com`
   * **API Key**: Copy your key from the web dashboard (e.g. `wotp_live_...`).
4. Tap **"Connect & Start Gateway"**.
5. The status badge will change to 🟢 **Connected**!

---

## 🔋 Step 3: Critical Android 24/7 Settings

To make sure Android never closes or sleeps the app:

1. **Disable Battery Optimization**:
   * In the app, tap the **"Disable Battery Optimization"** button.
   * Select **"Allow / Unrestricted"** in the Android system prompt.
2. **Keep the Phone Plugged into a Charger**:
   * Keep the phone permanently connected to a power outlet with Wi-Fi or 4G data active.
3. **Auto-Start on Reboot**:
   * The app is already equipped with a `BOOT_COMPLETED` receiver. If the phone ever restarts or loses power, it will automatically restart the background service upon boot.

---

## 🧪 Step 4: Testing Your First SMS

### From the Web Dashboard:
1. Open the dashboard at `http://localhost:3000`.
2. Look at the **Android Phone SMS Gateway** card:
   * You will see your phone model, carrier (e.g. Vodafone / T-Mobile), and battery percentage.
3. In the **Live OTP Sandbox**:
   * Click the **"SMS (Phone SIM)"** channel pill.
   * Enter your mobile number (e.g. `+1234567890`).
   * Click **"Send OTP via SMS (Android SIM)"**.
   * Your phone will send the SMS instantly!

### From REST API:
```bash
curl -X POST "http://localhost:3000/api/otp/send" \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{
    "phone": "+1234567890",
    "channel": "sms",
    "length": 6,
    "expiryMinutes": 5
  }'
```

### Channel Options:
* `channel: "sms"`: Sends directly through your Android phone SIM card.
* `channel: "whatsapp"`: Sends via linked WhatsApp account.
* `channel: "auto"`: Tries WhatsApp first; if WhatsApp is disconnected or fails, automatically falls back to your Android phone SMS!

---

## 📁 Source Code & Rebuilding

The full Android Studio project is located in:
`android-sms-gateway/`

To rebuild the APK at any time:
```bash
cd android-sms-gateway
JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" /Users/rogerpeter/.gradle/wrapper/dists/gradle-8.9-bin/90cnw93cvbtalezasaz0blq0a/gradle-8.9/bin/gradle assembleDebug
cp app/build/outputs/apk/debug/app-debug.apk ../public/downloads/fulla-sms-gateway.apk
```
