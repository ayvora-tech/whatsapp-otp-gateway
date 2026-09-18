# 🎓 Complete Guide: Deploy to Microsoft Azure for Students ($0 Forever)

As a student with an academic Microsoft account, you get **Azure for Students** with **NO credit card required**, **$100 in free credits**, and **750 hours/month of a Linux Virtual Machine (B1s)** which runs **24 hours a day, 7 days a week, completely free**.

Once deployed, **you can turn off your computer**, and your WhatsApp OTP Gateway will run in the cloud 24/7.

---

## 📋 Table of Contents
1. [Step 1: Activate Azure for Students (No Credit Card)](#step-1-activate-azure-for-students-no-credit-card)
2. [Step 2: Create the Free Ubuntu Virtual Machine](#step-2-create-the-free-ubuntu-virtual-machine)
3. [Step 3: Open Port 3000 in Azure Firewall](#step-3-open-port-3000-in-azure-firewall)
4. [Step 4: Connect to Your VM & Install Node.js](#step-4-connect-to-your-vm--install-nodejs)
5. [Step 5: Transfer Your Project to the VM](#step-5-transfer-your-project-to-the-vm)
6. [Step 6: Start the Server 24/7 with PM2](#step-6-start-the-server-247-with-pm2)
7. [Step 7: Link Your WhatsApp & Verify](#step-7-link-your-whatsapp--verify)
8. [Step 8: Connect Your App to the WhatsApp API](#step-8-connect-your-app-to-the-whatsapp-api)

---

## Step 1: Activate Azure for Students (No Credit Card)

1. Open your browser and go to: **[azure.microsoft.com/free/students](https://azure.microsoft.com/free/students)**
2. Click the green **Start free** button.
3. Sign in with your **school/academic Microsoft account** (e.g., `your_name@university.edu` or school domain).
4. Complete the academic verification (it sends a verification email or uses your school login portal).
5. Once verified, you will be taken to the **Azure Portal** (`portal.azure.com`).
   > ℹ️ Notice that **no credit card or billing details** were requested!

---

## Step 2: Create the Free Ubuntu Virtual Machine

1. In the top search bar of the Azure Portal, type **Virtual Machines** and click on it.
2. Click **Create** &rarr; **Azure virtual machine**.
3. Fill out the **Basics** tab:
   * **Subscription**: `Azure for Students`
   * **Resource Group**: Click *Create new* &rarr; type `rg-whatsapp` &rarr; click OK.
   * **Virtual machine name**: `whatsapp-gateway`
   * **Region**: Choose a region close to you (e.g. *East US*, *West Europe*, *UAE North*).
   * **Availability options**: *No infrastructure redundancy required*.
   * **Security type**: *Standard*.
   * **Image**: Select **Ubuntu Server 22.04 LTS - x64 Gen2**.
   * **Size**: Select **Standard_B1s** (1 vCPU, 1 GiB memory)
     > 💡 *Standard_B1s is the exact size included in the 750 free hours/month tier!*
   * **Administrator account**:
     * Select **Password** (easiest for beginners).
     * **Username**: `azureuser`
     * **Password**: Create a strong password (e.g., `WhatsApp2026!Gate#`). *Remember this password!*
   * **Inbound port rules**:
     * Public inbound ports: **Allow selected ports**
     * Select: **SSH (22)** and **HTTP (80)**.
4. Click the blue **Review + create** button at the bottom.
5. Once validation passes, click **Create**.
6. Wait 1–2 minutes until you see *"Your deployment is complete"*, then click **Go to resource**.
7. In the top-right of the Overview page, find your **Public IP address** (e.g., `20.120.45.89`). Copy it!

---

## Step 3: Open Port 3000 in Azure Firewall

Your WhatsApp Gateway web dashboard and REST API run on port `3000`. You must allow port 3000 in Azure:

1. On your Virtual Machine page in Azure, look at the left sidebar menu under **Settings** &rarr; click **Networking** (or **Network settings**).
2. Click the **Add inbound port rule** button on the right.
3. In the panel that opens, configure:
   * **Source**: `Any`
   * **Source port ranges**: `*`
   * **Destination**: `Any`
   * **Service**: `Custom`
   * **Destination port ranges**: `3000`
   * **Protocol**: `TCP`
   * **Action**: `Allow`
   * **Priority**: `310` (or leave default)
   * **Name**: `Port_3000_WhatsApp`
4. Click **Add**. Wait 15 seconds for the rule to apply.

---

## Step 4: Connect to Your VM & Install Node.js

1. Open the **Terminal** app on your Mac.
2. Connect to your Azure VM using SSH:
   ```bash
   ssh azureuser@YOUR_AZURE_PUBLIC_IP
   ```
   *(Replace `YOUR_AZURE_PUBLIC_IP` with your actual IP from Step 2)*

3. If it asks: `Are you sure you want to continue connecting (yes/no/[fingerprint])?`, type `yes` and press Enter.
4. Enter the **password** you set in Step 2. (The characters won't appear as you type for security; just type it and press Enter).
5. Once you are logged in to the Ubuntu VM, copy and paste this whole block of commands to install Node.js 20 and PM2:

   ```bash
   # Update system
   sudo apt update && sudo apt upgrade -y

   # Install Node.js 20 LTS
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt install -y nodejs git

   # Install PM2 (keeps the gateway running 24/7)
   sudo npm install -g pm2

   # Verify versions
   node -v && npm -v
   ```

---

## Step 5: Transfer Your Project to the VM

Now copy your project files from your Mac to your Azure VM.

### Option A: Direct Copy from your Mac (Fastest)
Open a **new tab in your Mac Terminal** (press `Cmd + T` so you are on your local Mac, not inside the VM) and run this one command:

```bash
rsync -avz --exclude 'node_modules' --exclude 'data/auth_info' \
  "/Users/rogerpeter/whatsapp otp project/" \
  azureuser@YOUR_AZURE_PUBLIC_IP:~/whatsapp-otp-gateway/
```
*(Enter your VM password when prompted)*

### Option B: Using GitHub
Alternatively, push your project to a private GitHub repository, and on the Azure VM run:
```bash
git clone https://github.com/YOUR_USERNAME/whatsapp-otp-project.git ~/whatsapp-otp-gateway
```

---

## Step 6: Start the Server 24/7 with PM2

Switch back to your **Azure VM terminal** (or SSH in again):

```bash
# 1. Navigate into the project folder
cd ~/whatsapp-otp-gateway

# 2. Install dependencies
npm install

# 3. Start the gateway in the background with PM2
pm2 start ecosystem.config.cjs

# 4. Save the process so it auto-starts if Azure reboots
pm2 save

# 5. Enable PM2 on system boot
pm2 startup
```

> ⚠️ When you run `pm2 startup`, it will display a command starting with `sudo env PATH=...`. Copy that exact line, paste it into the terminal, and press Enter.

To check that your server is running:
```bash
pm2 status
```
*(You will see `whatsapp-otp-gateway` with status `online`!)*

---

## Step 7: Link Your WhatsApp & Verify

1. Open your web browser on your computer or phone and go to:
   ```
   http://YOUR_AZURE_PUBLIC_IP:3000
   ```
2. You will see the **WhatsApp OTP Gateway Dashboard** with a live QR code!
3. Open **WhatsApp** on your mobile phone:
   * **iPhone**: Go to **Settings** &rarr; **Linked Devices** &rarr; **Link a Device**.
   * **Android**: Tap the 3 dots in the top right &rarr; **Linked Devices** &rarr; **Link a Device**.
4. Scan the QR code on your screen.
5. Within 2 seconds, the dashboard turns **🟢 Green (Connected)** and displays your phone number!

🎉 **CONGRATULATIONS!**
You can now:
* **Turn off your Mac computer.**
* **Disconnect your home Wi-Fi.**
* Your WhatsApp gateway will run **24/7 in Microsoft Azure cloud completely free ($0)**!

---

## Step 8: Connect Your App to the WhatsApp API

On your dashboard (`http://YOUR_AZURE_PUBLIC_IP:3000`), copy your **API Key** (e.g., `wotp_live_cc1bf...`).

Whenever your mobile app, website, or backend needs to send an OTP, send an HTTP POST request to your Azure server:

### 1. Send OTP (From your app / backend)
```javascript
// Example in JavaScript (Node.js, React, React Native, Flutter, etc.)
async function requestOtp(userPhoneNumber) {
  const response = await fetch("http://YOUR_AZURE_PUBLIC_IP:3000/api/otp/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": "YOUR_API_KEY_HERE"
    },
    body: JSON.stringify({
      phone: userPhoneNumber, // e.g. "+1234567890"
      length: 6,              // 6-digit code
      expiryMinutes: 5        // expires in 5 minutes
    })
  });

  const data = await response.json();
  if (data.success) {
    console.log("OTP sent successfully to WhatsApp!");
  } else {
    console.error("Failed to send OTP:", data.error);
  }
}
```

### 2. Verify OTP (When user inputs the 6 digits)
```javascript
async function verifyUserOtp(userPhoneNumber, codeEnteredByUser) {
  const response = await fetch("http://YOUR_AZURE_PUBLIC_IP:3000/api/otp/verify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": "YOUR_API_KEY_HERE"
    },
    body: JSON.stringify({
      phone: userPhoneNumber,
      code: codeEnteredByUser
    })
  });

  const result = await response.json();
  if (result.success && result.valid) {
    console.log("User verified successfully!");
    // Log user in or confirm registration
  } else {
    alert(result.error); // "Incorrect verification code. 4 attempt(s) remaining."
  }
}
```

---

## 🛠 Useful Azure Maintenance Commands

When SSH'd into your Azure VM:
* **View live WhatsApp logs**:
  ```bash
  pm2 logs whatsapp-otp-gateway
  ```
* **Restart the server**:
  ```bash
  pm2 restart whatsapp-otp-gateway
  ```
* **Stop the server**:
  ```bash
  pm2 stop whatsapp-otp-gateway
  ```
